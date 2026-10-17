#include "AppController.h"

#include <QAbstractNativeEventFilter>
#include <QCoreApplication>
#include <QDesktopServices>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QClipboard>
#include <QGuiApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLocalServer>
#include <QLocalSocket>
#include <QPageLayout>
#include <QPageSize>
#include <QPdfWriter>
#include <QProcess>
#include <QRegularExpression>
#include <QTextDocument>
#include <QUrl>

#include "Zip.h"
#include "noted/Database.h"
#include "noted/Sqlite.h"
#include "noted/NoteStore.h"
#include "noted/doc/Export.h"
#include "noted/doc/TipTap.h"

#ifdef Q_OS_WIN
#  ifndef WIN32_LEAN_AND_MEAN
#    define WIN32_LEAN_AND_MEAN
#  endif
#  ifndef NOMINMAX
#    define NOMINMAX
#  endif
#  include <windows.h>
#endif

using namespace noted;

namespace {

constexpr int kHotkeyId = 0x4E54;  // 'NT'

QString serverName()
{
    QString user = qEnvironmentVariable("USERNAME", qEnvironmentVariable("USER"));
    user.remove(QRegularExpression(QStringLiteral("[^A-Za-z0-9_-]")));
    return QStringLiteral("noted-qt-") + user;
}

QString safeFileName(QString s)
{
    s.replace(QRegularExpression(QStringLiteral("[\\\\/:*?\"<>|\\x00-\\x1f]")), QStringLiteral("-"));
    s = s.simplified();
    if (s.isEmpty()) s = QStringLiteral("Untitled");
    return s.left(120);
}

bool writeFile(const QString& path, const QByteArray& data, QString* err)
{
    QFile f(path);
    if (!f.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        *err = f.errorString();
        return false;
    }
    f.write(data);
    return true;
}

QString sqlLiteral(const QVariant& v)
{
    if (!v.isValid() || v.isNull()) return QStringLiteral("NULL");
    switch (v.typeId()) {
    case QMetaType::LongLong:
    case QMetaType::Int:
    case QMetaType::Double:
        return v.toString();
    default: {
        QString s = v.toString();
        s.replace(QLatin1Char('\''), QStringLiteral("''"));
        return QLatin1Char('\'') + s + QLatin1Char('\'');
    }
    }
}

}  // namespace

#ifdef Q_OS_WIN
class HotkeyFilter : public QAbstractNativeEventFilter
{
public:
    explicit HotkeyFilter(AppController* owner)
        : m_owner(owner)
    {}
    bool nativeEventFilter(const QByteArray& type, void* message, qintptr*) override
    {
        if (type != QByteArrayLiteral("windows_generic_MSG")) return false;
        return m_owner->nativeHotkey(message);
    }

private:
    AppController* m_owner;
};
#else
class HotkeyFilter
{};
#endif

AppController::AppController(NoteStore& store, QString dataPath, bool devData, QObject* parent)
    : QObject(parent)
    , m_store(store)
    , m_dataPath(std::move(dataPath))
    , m_devData(devData)
{}

AppController::~AppController()
{
#ifdef Q_OS_WIN
    if (m_hotkey) UnregisterHotKey(nullptr, kHotkeyId);
    if (m_filter) {
        QCoreApplication::instance()->removeNativeEventFilter(m_filter);
        delete m_filter;
    }
#endif
}

QString AppController::version() const
{
    return QStringLiteral(NOTED_VERSION_STRING);
}

bool AppController::claimSingleInstance(const QStringList& files)
{
    const QString name = serverName();
    {
        QLocalSocket probe;
        probe.connectToServer(name);
        if (probe.waitForConnected(300)) {
            probe.write(QJsonDocument(QJsonArray::fromStringList(files)).toJson(QJsonDocument::Compact));
            probe.flush();
            probe.waitForBytesWritten(1000);
            probe.disconnectFromServer();
            return false;
        }
    }
    QLocalServer::removeServer(name);
    m_server = new QLocalServer(this);
    m_server->setSocketOptions(QLocalServer::UserAccessOption);
    connect(m_server, &QLocalServer::newConnection, this, [this] {
        while (QLocalSocket* s = m_server->nextPendingConnection()) {
            connect(s, &QLocalSocket::readyRead, this, [this, s] {
                const QJsonArray arr = QJsonDocument::fromJson(s->readAll()).array();
                QStringList paths;
                for (const QJsonValue& v : arr) paths << v.toString();
                emit activateRequested();
                if (!paths.isEmpty()) emit filesOpened(paths);
            });
            connect(s, &QLocalSocket::disconnected, s, &QObject::deleteLater);
        }
    });
    m_server->listen(name);
    return true;
}

void AppController::openExternal(const QString& url)
{
    QUrl u(url);
    if (u.scheme().isEmpty()) u = QUrl(QStringLiteral("https://") + url);
    // Only hand web and mail links to the OS; never file:// or custom schemes
    // coming from note content.
    const QString scheme = u.scheme().toLower();
    if (scheme == u"http" || scheme == u"https" || scheme == u"mailto") QDesktopServices::openUrl(u);
}

void AppController::revealFile(const QString& path)
{
#ifdef Q_OS_WIN
    QProcess::startDetached(QStringLiteral("explorer.exe"), {QStringLiteral("/select,"), QDir::toNativeSeparators(path)});
#else
    QDesktopServices::openUrl(QUrl::fromLocalFile(QFileInfo(path).absolutePath()));
#endif
}

QString AppController::suggestedFileName(const QString& noteId, const QString& format)
{
    const QVariantMap n = m_store.note(noteId);
    return safeFileName(n.value("title").toString()) + QLatin1Char('.') + format;
}

bool AppController::copyAsMarkdown(const QString& noteId)
{
    const QVariantMap n = m_store.note(noteId);
    if (n.isEmpty() || (n.value("is_locked").toBool() && !m_store.isUnlocked(noteId))) return false;
    const bool plain = n.value("note_type").toString() == u"plain";
    const QString body = plain ? n.value("content").toString() : doc::toMarkdown(doc::parse(n.value("content").toString()));
    QGuiApplication::clipboard()->setText(QStringLiteral("# ") + n.value("title").toString() + QStringLiteral("\n\n") + body);
    return true;
}

QString AppController::exportNote(const QString& noteId, const QString& format, const QUrl& target)
{
    const QVariantMap n = m_store.note(noteId);
    if (n.isEmpty()) return QStringLiteral("Note not found");
    const QString path = target.isLocalFile() ? target.toLocalFile() : target.toString();
    const QString title = n.value("title").toString();
    const bool plain = n.value("note_type").toString() == u"plain";
    const QJsonObject json = plain ? doc::fromPlainText(n.value("content").toString())
                                   : doc::parse(n.value("content").toString());
    QString err;

    if (format == u"md") {
        const QString body = plain ? n.value("content").toString() : doc::toMarkdown(json);
        return writeFile(path, (QStringLiteral("# ") + title + QStringLiteral("\n\n") + body).toUtf8(), &err) ? QString() : err;
    }
    if (format == u"txt") {
        const QString body = plain ? n.value("content").toString() : doc::toPlainText(json);
        return writeFile(path, (title + QStringLiteral("\n\n") + body).toUtf8(), &err) ? QString() : err;
    }
    if (format == u"html" || format == u"doc") {
        const QString html = doc::toHtmlDocument(json, title, format == u"doc");
        return writeFile(path, html.toUtf8(), &err) ? QString() : err;
    }
    if (format == u"pdf") {
        QPdfWriter writer(path);
        writer.setTitle(title);
        writer.setCreator(QStringLiteral("noted."));
        writer.setPageSize(QPageSize(QPageSize::A4));
        writer.setPageMargins(QMarginsF(18, 18, 18, 18), QPageLayout::Millimeter);
        writer.setResolution(144);
        QTextDocument d;
        d.setDefaultFont(QFont(QStringLiteral("IBM Plex Sans"), 10));
        // QTextDocument's HTML subset ignores most CSS; keep it simple.
        d.setHtml(QStringLiteral("<h1>%1</h1>%2").arg(doc::escapeHtml(title), doc::toHtmlBody(json)));
        d.setPageSize(QSizeF(writer.width(), writer.height()));
        d.print(&writer);
        return QFileInfo::exists(path) ? QString() : QStringLiteral("Could not write PDF");
    }
    return QStringLiteral("Unknown format");
}

QString AppController::exportAll(const QString& format, const QUrl& target)
{
    const QString path = target.isLocalFile() ? target.toLocalFile() : target.toString();
    auto& c = m_store.database().conn();
    QString err;
    static const QStringList tables = {QStringLiteral("lists"), QStringLiteral("notes"), QStringLiteral("tags"),
                                       QStringLiteral("note_tags"), QStringLiteral("todo_lists"), QStringLiteral("todos"),
                                       QStringLiteral("settings")};
    if (format == u"json") {
        QJsonObject root{{"exported_at", QDateTime::currentDateTimeUtc().toString(Qt::ISODate)}, {"app", "noted"},
                         {"version", version()}};
        for (const QString& t : tables) {
            QVariantList rows = c.all(QStringLiteral("SELECT * FROM %1").arg(t));
            if (t == u"settings") {
                // Never export secrets.
                rows.erase(std::remove_if(rows.begin(), rows.end(), [](const QVariant& r) {
                               const QString k = r.toMap().value("key").toString();
                               return k.startsWith(u"lock_pin") || k.contains(u"Token") || k.contains(u"token");
                           }),
                           rows.end());
            }
            root.insert(t, QJsonArray::fromVariantList(rows));
        }
        return writeFile(path, QJsonDocument(root).toJson(QJsonDocument::Indented), &err) ? QString() : err;
    }
    if (format == u"sql") {
        QString out = QStringLiteral("-- noted. export %1\nBEGIN TRANSACTION;\n").arg(QDateTime::currentDateTime().toString(Qt::ISODate));
        for (const QString& t : tables) {
            if (t == u"settings") continue;
            for (const QVariant& r : c.all(QStringLiteral("SELECT * FROM %1").arg(t))) {
                const QVariantMap m = r.toMap();
                QStringList cols, vals;
                for (auto it = m.begin(); it != m.end(); ++it) {
                    cols << it.key();
                    vals << sqlLiteral(it.value());
                }
                out += QStringLiteral("INSERT INTO %1 (%2) VALUES (%3);\n").arg(t, cols.join(QStringLiteral(", ")), vals.join(QStringLiteral(", ")));
            }
        }
        out += QStringLiteral("COMMIT;\n");
        return writeFile(path, out.toUtf8(), &err) ? QString() : err;
    }
    if (format == u"zip") {
        ZipWriter zip;
        QSet<QString> used;
        const QVariantList lists = m_store.lists() + m_store.hiddenLists();
        QHash<QString, QString> listNames;
        for (const QVariant& l : lists) listNames.insert(l.toMap().value("id").toString(), safeFileName(l.toMap().value("name").toString()));
        for (const QVariant& r : c.all(QStringLiteral("SELECT id, title, content, note_type, list_id FROM notes WHERE is_trashed = 0"))) {
            const QVariantMap n = r.toMap();
            const bool plain = n.value("note_type").toString() == u"plain";
            const QString body = plain ? n.value("content").toString() : doc::toMarkdown(doc::parse(n.value("content").toString()));
            QString dir = listNames.value(n.value("list_id").toString());
            QString base = (dir.isEmpty() ? QString() : dir + QLatin1Char('/')) + safeFileName(n.value("title").toString());
            QString name = base + QStringLiteral(".md");
            for (int i = 2; used.contains(name.toLower()); ++i) name = QStringLiteral("%1 (%2).md").arg(base).arg(i);
            used.insert(name.toLower());
            zip.add(name, (QStringLiteral("# ") + n.value("title").toString() + QStringLiteral("\n\n") + body).toUtf8());
        }
        return writeFile(path, zip.finish(), &err) ? QString() : err;
    }
    return QStringLiteral("Unknown format");
}

QString AppController::importFile(const QString& path)
{
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return {};
    QString text = QString::fromUtf8(f.readAll());
    if (text.startsWith(QChar(0xFEFF))) text.remove(0, 1);
    text.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
    const QFileInfo info(path);
    const QString ext = info.suffix().toLower();
    QVariantMap data;
    if (ext == u"md" || ext == u"markdown") {
        QString title = info.completeBaseName();
        // A leading "# Heading" becomes the title.
        static const QRegularExpression h1(QStringLiteral("^\\s*#\\s+(.+)\\n?"));
        if (auto m = h1.match(text); m.hasMatch()) {
            title = m.captured(1).trimmed();
            text = text.mid(m.capturedEnd());
        }
        const QJsonObject json = doc::fromMarkdown(text);
        data = {{"title", title}, {"content", doc::stringify(json)}, {"content_plain", doc::toPlainText(json)}, {"note_type", "rich"}};
    } else {
        data = {{"title", info.completeBaseName()}, {"content", text}, {"content_plain", text}, {"note_type", "plain"}};
    }
    return m_store.createNote(data).value("id").toString();
}

QString AppController::plainToRich(const QString& text) const
{
    return doc::stringify(doc::fromPlainText(text));
}

void AppController::registerQuickCaptureHotkey()
{
#ifdef Q_OS_WIN
    if (m_hotkey) return;
    if (!m_filter) {
        m_filter = new HotkeyFilter(this);
        QCoreApplication::instance()->installNativeEventFilter(m_filter);
    }
    m_hotkey = RegisterHotKey(nullptr, kHotkeyId, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, 'N');
    if (!m_hotkey) qWarning() << "Ctrl+Alt+N is taken by another app; quick capture hotkey disabled";
    emit hotkeyChanged();
#endif
}

bool AppController::nativeHotkey(void* message)
{
#ifdef Q_OS_WIN
    auto* msg = static_cast<MSG*>(message);
    if (msg->message == WM_HOTKEY && msg->wParam == kHotkeyId) {
        emit quickCaptureRequested();
        return true;
    }
#else
    Q_UNUSED(message)
#endif
    return false;
}
