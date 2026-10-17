#include "OpenFiles.h"

#include "noted/NoteStore.h"
#include "noted/doc/Export.h"
#include "noted/doc/TipTap.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QCryptographicHash>
#include <QSaveFile>
#include <QStandardPaths>
#include <QUrl>

namespace {

const QString kPrefix = QStringLiteral("file:");
const QString kSetting = QStringLiteral("qt.openFiles");

bool isMarkdown(const QString& path)
{
    const QString ext = QFileInfo(path).suffix().toLower();
    return ext == u"md" || ext == u"markdown";
}

QString markdownFor(const QJsonObject& doc)
{
    QString md = noted::doc::toMarkdown(doc).trimmed();
    if (!md.isEmpty()) md += QLatin1Char('\n');
    return md;
}

QString stamp(const QDateTime& dt)
{
    return dt.isValid() ? dt.toUTC().toString(Qt::ISODateWithMs) : QString();
}

}  // namespace

OpenFiles::OpenFiles(noted::NoteStore& store, QObject* parent)
    : QObject(parent)
    , m_store(store)
{
    connect(&m_watcher, &QFileSystemWatcher::fileChanged, this, &OpenFiles::onDiskChange);
    const QJsonArray saved = QJsonDocument::fromJson(m_store.setting(kSetting, QStringLiteral("[]")).toUtf8()).array();
    for (const QJsonValue& v : saved) {
        const QString path = v.toString();
        if (path.isEmpty() || m_paths.contains(path) || !QFileInfo::exists(path)) continue;
        m_paths << path;
        m_watcher.addPath(path);
    }
}

QVariantList OpenFiles::files() const
{
    QVariantList out;
    for (const QString& p : m_paths)
        out << QVariantMap{{"id", kPrefix + p}, {"path", QDir::toNativeSeparators(p)}, {"name", QFileInfo(p).fileName()}};
    return out;
}

bool OpenFiles::isFile(const QString& id) { return id.startsWith(kPrefix); }

QString OpenFiles::pathOf(const QString& id) { return isFile(id) ? id.mid(kPrefix.size()) : QString(); }

QString OpenFiles::open(const QString& pathOrUrl)
{
    const QUrl url(pathOrUrl);
    QString path = url.isLocalFile() ? url.toLocalFile() : pathOrUrl;
    const QFileInfo info(path);
    if (!info.isFile()) return {};
    path = info.canonicalFilePath();
    Format f;
    if (!readFile(path, f)) return {};
    m_formats.insert(path, f);
    if (!m_paths.contains(path)) {
        m_paths << path;
        m_watcher.addPath(path);
        persist();
        emit filesChanged();
    }
    return kPrefix + path;
}

void OpenFiles::close(const QString& id)
{
    const QString path = pathOf(id);
    if (!m_paths.removeOne(path)) return;
    QFile::remove(originalPath(path));
    m_watcher.removePath(path);
    m_formats.remove(path);
    persist();
    emit filesChanged();
}

QVariantMap OpenFiles::note(const QString& id)
{
    const QString path = pathOf(id);
    if (!m_paths.contains(path)) return {};
    Format f;
    if (!readFile(path, f)) return {};
    m_formats.insert(path, f);
    const QFileInfo info(path);
    const QDateTime born = info.birthTime().isValid() ? info.birthTime() : info.lastModified();
    QVariantMap n{{"id", id},
                  {"title", info.fileName()},
                  {"is_file", true},
                  {"file_path", QDir::toNativeSeparators(path)},
                  {"created_at", stamp(born)},
                  {"updated_at", stamp(info.lastModified())},
                  {"content_plain", f.text}};
    if (isMarkdown(path)) {
        const QJsonObject doc = noted::doc::fromMarkdown(f.text);
        m_formats[path].unchangedMarkdown = markdownFor(doc);
        n.insert("note_type", QStringLiteral("rich"));
        n.insert("content", noted::doc::stringify(doc));
    } else {
        n.insert("note_type", QStringLiteral("plain"));
        n.insert("content", f.text);
    }
    return n;
}

bool OpenFiles::writeText(const QString& id, const QString& text)
{
    const QString path = pathOf(id);
    return m_paths.contains(path) && write(path, text);
}

bool OpenFiles::writeDoc(const QString& id, const QJsonObject& doc)
{
    const QString md = markdownFor(doc);
    if (md == m_formats.value(pathOf(id)).unchangedMarkdown) return true;  // no real edit
    return writeText(id, md);
}

bool OpenFiles::readFile(const QString& path, Format& out) const
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return false;
    QString text = QString::fromUtf8(file.readAll());
    out.bom = text.startsWith(QChar(0xFEFF));
    if (out.bom) text.remove(0, 1);
    out.crlf = text.contains(QStringLiteral("\r\n"));
    text.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
    out.text = text;
    return true;
}

QString OpenFiles::originalPath(const QString& path) const
{
    const QString dir = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation) + QStringLiteral("/file-originals");
    const QByteArray key = QCryptographicHash::hash(QDir::cleanPath(path).toLower().toUtf8(), QCryptographicHash::Sha1).toHex();
    return dir + u'/' + QString::fromLatin1(key);
}

bool OpenFiles::hasOriginal(const QString& id) const
{
    const QString path = pathOf(id);
    QFile orig(originalPath(path)), now(path);
    if (!m_paths.contains(path) || !orig.open(QIODevice::ReadOnly)) return false;
    return !now.open(QIODevice::ReadOnly) || orig.readAll() != now.readAll();
}

bool OpenFiles::restoreOriginal(const QString& id)
{
    const QString path = pathOf(id);
    QFile orig(originalPath(path));
    if (!m_paths.contains(path) || !orig.open(QIODevice::ReadOnly)) return false;
    const QByteArray bytes = orig.readAll();
    QSaveFile file(path);
    if (!file.open(QIODevice::WriteOnly) || file.write(bytes) < 0 || !file.commit()) {
        emit writeFailed(id, file.errorString());
        return false;
    }
    if (!m_watcher.files().contains(path)) m_watcher.addPath(path);
    Format f;
    if (readFile(path, f)) m_formats.insert(path, f);
    emit externallyChanged(id);   // the editor shows what's on disk now
    return true;
}

bool OpenFiles::canOpen(const QString& pathOrUrl)
{
    const QUrl url(pathOrUrl);
    const QFileInfo info(url.isLocalFile() ? url.toLocalFile() : pathOrUrl);
    static const QStringList kinds{QStringLiteral("md"), QStringLiteral("markdown"), QStringLiteral("txt"), QStringLiteral("text"),
                                   QStringLiteral("log"), QStringLiteral("csv"), QStringLiteral("json"), QStringLiteral("yaml"),
                                   QStringLiteral("yml"), QStringLiteral("toml"), QStringLiteral("ini")};
    return info.isFile() && kinds.contains(info.suffix().toLower());
}

bool OpenFiles::write(const QString& path, const QString& text)
{
    Format& f = m_formats[path];
    if (f.text == text && QFileInfo::exists(path)) return true;
    // The first time noted changes this file, keep the file as it was.
    const QString orig = originalPath(path);
    if (!QFileInfo::exists(orig) && QFileInfo::exists(path)) {
        QDir().mkpath(QFileInfo(orig).absolutePath());
        QFile::copy(path, orig);
    }
    QString out = text;
    if (f.crlf) out.replace(QLatin1Char('\n'), QStringLiteral("\r\n"));
    if (f.bom) out.prepend(QChar(0xFEFF));
    // Remember it first: the watcher fires for our own write too.
    const QString previous = f.text;
    f.text = text;
    QSaveFile file(path);
    if (!file.open(QIODevice::WriteOnly) || file.write(out.toUtf8()) < 0 || !file.commit()) {
        f.text = previous;
        emit writeFailed(kPrefix + path, file.errorString());
        return false;
    }
    // QSaveFile replaces the file, which drops it from the watcher.
    if (!m_watcher.files().contains(path)) m_watcher.addPath(path);
    return true;
}

void OpenFiles::persist()
{
    QJsonArray a;
    for (const QString& p : m_paths) a.append(p);
    m_store.setSetting(kSetting, QString::fromUtf8(QJsonDocument(a).toJson(QJsonDocument::Compact)));
}

void OpenFiles::onDiskChange(const QString& path)
{
    // Editors that save by replacing the file drop it from the watcher.
    if (QFileInfo::exists(path) && !m_watcher.files().contains(path)) m_watcher.addPath(path);
    if (!m_paths.contains(path)) return;
    Format now;
    if (readFile(path, now) && m_formats.contains(path) && now.text == m_formats.value(path).text) return;
    emit externallyChanged(kPrefix + path);
}
