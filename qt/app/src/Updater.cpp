#include "Updater.h"

#include <QCoreApplication>
#include <QCryptographicHash>
#include <QDebug>
#include <QDir>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QProcess>
#include <QRegularExpression>
#include <QStandardPaths>

#include "noted/NoteStore.h"
#include "noted/sync/Crypto.h"

namespace {

// The public half of personal/update-signing.key (noted-release pubkey).
const QByteArray kUpdateKey = QByteArray::fromBase64("soHhhhjvR3dvUIVGuY4Y8nkfusujdPytgRpT+OGRC0g=");
const QString kFeed = QStringLiteral("https://github.com/vygr-labs/noted-desktop-app/releases/latest/download/noted-update.json");
const QString kDownloads = QStringLiteral("https://github.com/vygr-labs/noted-desktop-app/releases/download/v%1/%2");

QString sha256Of(const QString& path)
{
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return {};
    QCryptographicHash h(QCryptographicHash::Sha256);
    h.addData(&f);
    return QString::fromLatin1(h.result().toHex());
}

}  // namespace

Updater::Updater(noted::NoteStore& store, bool devBuild, QObject* parent)
    : QObject(parent)
    , m_store(store)
{
    // NOTED_UPDATE_FEED points a dev build at a test feed (a file:// URL works).
    m_feed = qEnvironmentVariable("NOTED_UPDATE_FEED");
    m_supported = !devBuild || !m_feed.isEmpty();
    if (m_feed.isEmpty()) m_feed = kFeed;
#ifndef Q_OS_WIN
    m_supported = false;  // installers are Windows-only so far
#endif
    m_automatic = m_store.setting(QStringLiteral("qt.autoUpdate"), QStringLiteral("1")) != u"0";
    m_timer.setInterval(6 * 3600 * 1000);
    connect(&m_timer, &QTimer::timeout, this, [this] { if (m_automatic) check(); });
    if (m_supported) {
        m_timer.start();
        QTimer::singleShot(60 * 1000, this, [this] { if (m_automatic) check(); });
    }
}

Updater::~Updater()
{
    if (m_reply) m_reply->abort();
}

QString Updater::version() const { return QStringLiteral(NOTED_VERSION_STRING); }

void Updater::setAutomatic(bool on)
{
    if (on == m_automatic) return;
    m_automatic = on;
    m_store.setSetting(QStringLiteral("qt.autoUpdate"), on ? QStringLiteral("1") : QStringLiteral("0"));
    emit changed();
}

bool Updater::newer(const QString& a, const QString& b)
{
    const QStringList x = a.split(QLatin1Char('.')), y = b.split(QLatin1Char('.'));
    for (int i = 0; i < qMax(x.size(), y.size()); ++i) {
        const int p = x.value(i).toInt(), q = y.value(i).toInt();
        if (p != q) return p > q;
    }
    return false;
}

void Updater::set(const QString& state, const QString& error)
{
    m_state = state;
    m_error = error;
    emit changed();
}

QString Updater::updatesDir() const
{
    const QString d = QStandardPaths::writableLocation(QStandardPaths::AppLocalDataLocation) + QStringLiteral("/updates");
    QDir().mkpath(d);
    return d;
}

void Updater::check()
{
    if (!m_supported || m_state == u"checking" || m_state == u"downloading" || m_state == u"ready") return;
    set(QStringLiteral("checking"));
    QNetworkRequest req{QUrl(m_feed)};
    req.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("noted/") + version());
    req.setTransferTimeout(30000);
    QNetworkReply* r = m_net.get(req);
    connect(r, &QNetworkReply::finished, this, [this, r] { gotManifest(r); });
}

void Updater::gotManifest(QNetworkReply* reply)
{
    reply->deleteLater();
    if (reply->error() != QNetworkReply::NoError) {
        // No manifest in the latest release yet is just "nothing new".
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        if (status == 404) { set(QStringLiteral("current")); return; }
        set(QStringLiteral("failed"), QStringLiteral("Couldn’t reach the update server."));
        return;
    }
    QJsonObject m = QJsonDocument::fromJson(reply->readAll()).object();
    const QByteArray sig = QByteArray::fromBase64(m.take(QStringLiteral("sig")).toString().toLatin1());
    if (!noted::sync::verify(kUpdateKey, QJsonDocument(m).toJson(QJsonDocument::Compact), sig)) {
        qWarning() << "update: manifest signature doesn't check out; ignoring it";
        set(QStringLiteral("failed"), QStringLiteral("The update couldn’t be verified, so it wasn’t downloaded."));
        return;
    }
    const QString v = m.value(QStringLiteral("version")).toString();
    if (!newer(v, version())) { set(QStringLiteral("current")); return; }
    m_latest = v;
    m_notes = m.value(QStringLiteral("notes")).toString();
    m_file = m.value(QStringLiteral("file")).toString();
    m_sha256 = m.value(QStringLiteral("sha256")).toString().toLower();
    m_size = qint64(m.value(QStringLiteral("size")).toDouble());
    static const QRegularExpression safe(QStringLiteral("^[A-Za-z0-9._-]+\\.exe$"));
    if (!safe.match(m_file).hasMatch() || m_sha256.size() != 64) {
        set(QStringLiteral("failed"), QStringLiteral("The update’s details didn’t make sense."));
        return;
    }
    const QString path = updatesDir() + QLatin1Char('/') + m_file;
    if (QFileInfo(path).size() == m_size && sha256Of(path) == m_sha256) {
        m_installer = path;
        set(QStringLiteral("ready"));
        return;
    }
    const QString url = m.value(QStringLiteral("url")).toString();
    download(QUrl(url.isEmpty() ? kDownloads.arg(v, m_file) : url));
}

void Updater::download(const QUrl& url)
{
    const QString part = updatesDir() + QLatin1Char('/') + m_file + QStringLiteral(".part");
    m_part = std::make_unique<QFile>(part);
    if (!m_part->open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        set(QStringLiteral("failed"), QStringLiteral("Couldn’t save the update."));
        return;
    }
    m_progress = 0;
    set(QStringLiteral("downloading"));
    QNetworkRequest req{url};
    req.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("noted/") + version());
    m_reply = m_net.get(req);
    connect(m_reply, &QNetworkReply::readyRead, this, [this] { m_part->write(m_reply->readAll()); });
    connect(m_reply, &QNetworkReply::downloadProgress, this, [this](qint64 got, qint64 total) {
        const qint64 all = total > 0 ? total : m_size;
        m_progress = all > 0 ? double(got) / double(all) : 0;
        emit changed();
    });
    connect(m_reply, &QNetworkReply::finished, this, [this] {
        QNetworkReply* r = m_reply;
        r->deleteLater();
        m_part->write(r->readAll());
        const QString partPath = m_part->fileName();
        m_part->close();
        m_part.reset();
        if (r->error() != QNetworkReply::NoError) {
            QFile::remove(partPath);
            set(QStringLiteral("failed"), QStringLiteral("The download stopped. It’ll try again later."));
            return;
        }
        // Exactly the file the signed manifest describes, or nothing.
        if (QFileInfo(partPath).size() != m_size || sha256Of(partPath) != m_sha256) {
            QFile::remove(partPath);
            set(QStringLiteral("failed"), QStringLiteral("The download didn’t match the update, so it was thrown away."));
            return;
        }
        const QString path = updatesDir() + QLatin1Char('/') + m_file;
        QFile::remove(path);
        QFile::rename(partPath, path);
        m_installer = path;
        set(QStringLiteral("ready"));
    });
}

bool Updater::install()
{
    if (m_state != u"ready" || m_installer.isEmpty() || sha256Of(m_installer) != m_sha256) return false;
    // /RELAUNCH: our installer opens noted again when it's done.
    return QProcess::startDetached(m_installer, {QStringLiteral("/VERYSILENT"), QStringLiteral("/SUPPRESSMSGBOXES"),
                                                 QStringLiteral("/NORESTART"), QStringLiteral("/RELAUNCH")});
}
