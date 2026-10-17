#include "noted/sync/SyncEngine.h"

#include <QDebug>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUrl>
#include <QtConcurrent/QtConcurrentRun>

#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/Sqlite.h"
#include "noted/doc/TipTap.h"
#include "noted/sync/Crypto.h"

namespace noted {

using namespace sync;

namespace {

const QString kMarker = QStringLiteral("noted-sync.json");

QJsonObject readJson(const QString& path)
{
    QFile f(path);
    if (!f.open(QIODevice::ReadOnly)) return {};
    return QJsonDocument::fromJson(f.readAll()).object();
}

bool writeFile(const QString& path, const QByteArray& data)
{
    QSaveFile f(path);
    if (!f.open(QIODevice::WriteOnly)) return false;
    f.write(data);
    return f.commit();
}

QByteArray b64(const QString& s) { return QByteArray::fromBase64(s.toLatin1()); }
QString b64(const QByteArray& b) { return QString::fromLatin1(b.toBase64()); }

// A folder name from a list name: no characters Windows or macOS refuse.
QString folderName(QString name)
{
    name.replace(QRegularExpression(QStringLiteral("[<>:\"/\\\\|?*\\x00-\\x1f]")), QStringLiteral(" "));
    name = name.simplified();
    if (name.isEmpty()) name = QStringLiteral("Shared list");
    return name.left(60) + QStringLiteral(" (noted)");
}

}  // namespace

SyncEngine::SyncEngine(Database& db, NoteStore& store, QObject* parent)
    : QObject(parent)
    , m_db(db)
    , m_store(store)
    , m_ledger(std::make_unique<Ledger>(db, [](const QString& content, bool plain) {
        return plain ? content : NoteStore::plainFromContent(content);
    }))
{
    m_debounce.setSingleShot(true);
    m_debounce.setInterval(3000);
    connect(&m_debounce, &QTimer::timeout, this, &SyncEngine::publish);
    m_poll.setInterval(20000);
    connect(&m_poll, &QTimer::timeout, this, &SyncEngine::pull);
    connect(&m_reader, &QFutureWatcher<QList<Pulled>>::finished, this, [this] { finishPull(m_reader.result()); });

    for (auto sig : {&NoteStore::notesChanged, &NoteStore::listsChanged, &NoteStore::tagsChanged, &NoteStore::todosChanged,
                     &NoteStore::lockPinChanged})
        connect(&m_store, sig, this, &SyncEngine::schedule);
    connect(&m_db, &Database::externalChange, this, &SyncEngine::schedule);

    try {
        if (m_db.conn().scalar(QStringLiteral("SELECT count(*) FROM sqlite_master WHERE name = 'sync_spaces'")).toInt()) {
            m_spaces = m_ledger->spaces();
            if (!m_spaces.isEmpty()) {
                ensureTriggers();
                m_status = QStringLiteral("idle");
                m_poll.start();
                QTimer::singleShot(1500, this, &SyncEngine::syncNow);
            }
        }
    } catch (const db::Error& e) {
        qWarning() << "sync: couldn't start:" << e.what();
    }
}

SyncEngine::~SyncEngine()
{
    m_reader.waitForFinished();
}

// ── properties ────────────────────────────────────────────────────────────

Space* SyncEngine::library()
{
    for (Space& s : m_spaces)
        if (s.kind == u"library") return &s;
    return nullptr;
}

bool SyncEngine::enabled() const
{
    for (const Space& s : m_spaces)
        if (s.kind == u"library") return true;
    return false;
}

QString SyncEngine::folder() const
{
    for (const Space& s : m_spaces)
        if (s.kind == u"library") return QDir::toNativeSeparators(s.root);
    return {};
}

QVariantList SyncEngine::sharedLists() const
{
    QVariantList out;
    for (const Space& s : m_spaces) {
        if (s.kind != u"list") continue;
        const QString name = m_db.conn().scalar(QStringLiteral("SELECT name FROM lists WHERE id = ?"), {s.listId}).toString();
        out << QVariantMap{{"listId", s.listId}, {"name", name.isEmpty() ? s.name : name},
                           {"folder", QDir::toNativeSeparators(s.root)}, {"code", keyToCode(s.key)}};
    }
    return out;
}

void SyncEngine::setStatus(const QString& s, const QString& error)
{
    m_status = s;
    m_error = error;
    emit changed();
}

QString SyncEngine::localPath(const QString& folder) const
{
    if (folder.startsWith(QStringLiteral("file:"))) return QUrl(folder).toLocalFile();
    return QDir::fromNativeSeparators(folder);
}

QVariantMap SyncEngine::inspect(const QString& folder) const
{
    const QString path = localPath(folder);
    for (const QString& root : {path, path + QStringLiteral("/noted")}) {
        const QJsonObject j = readJson(root + QLatin1Char('/') + kMarker);
        if (!j.isEmpty())
            return {{"kind", j.value(QStringLiteral("kind")).toString()}, {"root", QDir::toNativeSeparators(root)}};
    }
    return {{"kind", QString()}, {"root", QDir::toNativeSeparators(path)}};
}

QString SyncEngine::codeFor(const QString& listId) const
{
    for (const Space& s : m_spaces)
        if (s.kind == u"list" && s.listId == listId) return keyToCode(s.key);
    return {};
}

bool SyncEngine::isShared(const QString& listId) const { return !codeFor(listId).isEmpty(); }

// ── setting up ────────────────────────────────────────────────────────────

void SyncEngine::ensureTriggers()
{
    m_ledger->install();
    m_me = m_ledger->deviceId();
}

void SyncEngine::setUp(const QString& folderIn, const QString& passphrase)
{
    if (m_busy) return;
    const QString folder = localPath(folderIn);
    if (passphrase.size() < 8) { emit setupFinished(false, QStringLiteral("Use a passphrase of at least 8 characters.")); return; }
    if (folder.isEmpty() || !QDir(folder).exists()) { emit setupFinished(false, QStringLiteral("That folder isn’t there.")); return; }
    const QVariantMap info = inspect(folder);
    const QString kind = info.value("kind").toString();
    if (kind == u"list") {
        emit setupFinished(false, QStringLiteral("That’s a shared list’s folder. Join it from Shared lists instead."));
        return;
    }
    QString root = QDir::fromNativeSeparators(info.value("root").toString());
    QJsonObject marker;
    if (kind == u"library") {
        marker = readJson(root + QLatin1Char('/') + kMarker);
    } else {
        root = folder + QStringLiteral("/noted");
        marker = {{"format", 1}, {"kind", "library"}, {"id", Database::newId()}, {"salt", b64(randomBytes(16))}};
    }
    m_busy = true;
    emit changed();
    const QByteArray salt = b64(marker.value(QStringLiteral("salt")).toString());
    auto* watcher = new QFutureWatcher<QByteArray>(this);
    connect(watcher, &QFutureWatcher<QByteArray>::finished, this, [=, this] {
        watcher->deleteLater();
        m_busy = false;
        const QByteArray key = watcher->result();
        QJsonObject m = marker;
        const QString id = m.value(QStringLiteral("id")).toString();
        if (kind == u"library") {
            const auto check = open(key, b64(m.value(QStringLiteral("check")).toString()), "check");
            if (!check) {
                emit changed();
                emit setupFinished(false, QStringLiteral("That passphrase doesn’t open the notes in this folder."));
                return;
            }
        } else {
            m.insert(QStringLiteral("check"), b64(seal(key, QJsonDocument(QJsonObject{{"kind", "library"}, {"id", id}}).toJson(QJsonDocument::Compact), "check")));
            if (!QDir().mkpath(root + QStringLiteral("/devices")) || !writeFile(root + QLatin1Char('/') + kMarker, QJsonDocument(m).toJson())) {
                emit changed();
                emit setupFinished(false, QStringLiteral("Couldn’t write to that folder."));
                return;
            }
        }
        try {
            ensureTriggers();
            Space s;
            s.id = id;
            s.kind = QStringLiteral("library");
            s.root = root;
            s.key = key;
            s.name = QStringLiteral("Library");
            m_ledger->saveSpace(s);
            m_ledger->seed(s);
            m_spaces = m_ledger->spaces();
            m_scanAttachments = true;
        } catch (const db::Error& e) {
            emit changed();
            emit setupFinished(false, QString::fromUtf8(e.what()));
            return;
        }
        m_status = QStringLiteral("idle");
        m_poll.start();
        emit changed();
        emit setupFinished(true, kind == u"library" ? QStringLiteral("Joined. Notes from your other computers are on their way.")
                                                   : QStringLiteral("Syncing. Set up your other computers with the same folder and passphrase."));
        syncNow();
    });
    watcher->setFuture(QtConcurrent::run([passphrase, salt] { return deriveKey(passphrase, salt); }));
}

void SyncEngine::turnOff()
{
    Space* lib = library();
    if (!lib) return;
    try {
        m_ledger->removeSpace(lib->id);
        m_spaces = m_ledger->spaces();
        if (m_spaces.isEmpty()) {
            m_ledger->uninstall();
            m_poll.stop();
            m_status = QStringLiteral("off");
        }
    } catch (const db::Error& e) {
        qWarning() << "sync: turning off:" << e.what();
    }
    emit changed();
}

QString SyncEngine::shareList(const QString& listId, const QString& folderIn)
{
    const QString folder = localPath(folderIn);
    if (isShared(listId)) return codeFor(listId);
    if (folder.isEmpty() || !QDir(folder).exists()) { setStatus(m_status, QStringLiteral("That folder isn’t there.")); return {}; }
    const QString name = m_db.conn().scalar(QStringLiteral("SELECT name FROM lists WHERE id = ?"), {listId}).toString();
    QString root = folder + QLatin1Char('/') + folderName(name);
    for (int n = 2; QFileInfo::exists(root); ++n) root = folder + QLatin1Char('/') + folderName(name + QStringLiteral(" %1").arg(n));
    const QByteArray key = randomBytes(kKeySize);
    const QString id = Database::newId();
    const QJsonObject marker{{"format", 1}, {"kind", "list"}, {"id", id},
                             {"check", b64(seal(key, QJsonDocument(QJsonObject{{"kind", "list"}, {"id", id}, {"list", listId}, {"name", name}})
                                                         .toJson(QJsonDocument::Compact), "check"))}};
    if (!QDir().mkpath(root + QStringLiteral("/devices")) || !writeFile(root + QLatin1Char('/') + kMarker, QJsonDocument(marker).toJson())) {
        setStatus(m_status, QStringLiteral("Couldn’t write to that folder."));
        return {};
    }
    try {
        ensureTriggers();
        Space s;
        s.id = id;
        s.kind = QStringLiteral("list");
        s.root = root;
        s.key = key;
        s.listId = listId;
        s.name = name;
        m_ledger->saveSpace(s);
        m_ledger->seed(s);
        m_spaces = m_ledger->spaces();
        markSharedLists();
    } catch (const db::Error& e) {
        setStatus(m_status, QString::fromUtf8(e.what()));
        return {};
    }
    if (m_status == u"off") m_status = QStringLiteral("idle");
    m_poll.start();
    emit changed();
    publish();
    return keyToCode(key);
}

bool SyncEngine::joinList(const QString& folderIn, const QString& code)
{
    const QVariantMap info = inspect(folderIn);
    if (info.value("kind").toString() != u"list") {
        setStatus(m_status, QStringLiteral("There’s no shared list in that folder."));
        return false;
    }
    const auto key = codeToKey(code);
    if (!key) {
        setStatus(m_status, QStringLiteral("That code isn’t complete. It’s 52 letters and numbers."));
        return false;
    }
    const QString root = QDir::fromNativeSeparators(info.value("root").toString());
    const QJsonObject marker = readJson(root + QLatin1Char('/') + kMarker);
    const auto check = open(*key, b64(marker.value(QStringLiteral("check")).toString()), "check");
    if (!check) {
        setStatus(m_status, QStringLiteral("That code is for a different list."));
        return false;
    }
    const QJsonObject about = QJsonDocument::fromJson(*check).object();
    try {
        ensureTriggers();
        Space s;
        s.id = marker.value(QStringLiteral("id")).toString();
        s.kind = QStringLiteral("list");
        s.root = root;
        s.key = *key;
        s.listId = about.value(QStringLiteral("list")).toString();
        s.name = about.value(QStringLiteral("name")).toString();
        m_ledger->saveSpace(s);
        m_spaces = m_ledger->spaces();
        m_scanAttachments = true;
    } catch (const db::Error& e) {
        setStatus(m_status, QString::fromUtf8(e.what()));
        return false;
    }
    if (m_status == u"off") m_status = QStringLiteral("idle");
    m_error.clear();
    m_poll.start();
    emit changed();
    syncNow();
    return true;
}

void SyncEngine::stopSharing(const QString& listId)
{
    try {
        for (const Space& s : m_spaces)
            if (s.kind == u"list" && s.listId == listId) m_ledger->removeSpace(s.id);
        m_db.conn().run(QStringLiteral("UPDATE lists SET is_shared = 0 WHERE id = ?"), {listId});
        m_spaces = m_ledger->spaces();
        if (m_spaces.isEmpty()) {
            m_ledger->uninstall();
            m_poll.stop();
            m_status = QStringLiteral("off");
        }
    } catch (const db::Error& e) {
        qWarning() << "sync: stop sharing:" << e.what();
    }
    emit changed();
    emit m_store.listsChanged();
}

void SyncEngine::markSharedLists()
{
    auto& c = m_db.conn();
    for (const Space& s : m_spaces)
        if (s.kind == u"list") c.run(QStringLiteral("UPDATE lists SET is_shared = 1 WHERE id = ? AND COALESCE(is_shared, 0) = 0"), {s.listId});
}

// ── the loop ──────────────────────────────────────────────────────────────

void SyncEngine::schedule()
{
    if (m_spaces.isEmpty()) return;
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (!m_firstPending) m_firstPending = now;
    // Typing for a long stretch still goes out every 20 seconds.
    if (now - m_firstPending > 20000) publish();
    else m_debounce.start();
}

void SyncEngine::syncNow()
{
    publish();
    pull();
}

void SyncEngine::runOnce()
{
    publish();
    finishPull(read(m_spaces, m_me));
}

QList<SyncEngine::Pulled> SyncEngine::read(const QList<Space>& spaces, const QString& me)
{
    static const QRegularExpression fileRe(QStringLiteral("^(\\d{8})\\.nchg$"));
    QList<Pulled> out;
    for (const Space& s : spaces) {
        Pulled p;
        p.space = s.id;
        p.cursors = s.cursors;
        const QDir devices(s.root + QStringLiteral("/devices"));
        if (!QFileInfo::exists(s.root + QLatin1Char('/') + kMarker)) {
            p.reachable = false;
            out << p;
            continue;
        }
        for (const QString& dev : devices.entryList(QDir::Dirs | QDir::NoDotAndDotDot)) {
            if (dev == me) continue;
            QFile mf(devices.filePath(dev + QStringLiteral("/device.nmeta")));
            if (mf.open(QIODevice::ReadOnly)) {
                if (const auto meta = open(s.key, mf.readAll(), (dev + QStringLiteral("/meta")).toUtf8())) {
                    const QJsonObject m = QJsonDocument::fromJson(*meta).object();
                    p.names.insert(dev, m.value(QStringLiteral("name")).toString());
                    p.seen.insert(dev, QDateTime::fromString(m.value(QStringLiteral("at")).toString(), Qt::ISODate));
                }
            }
            qint64 cursor = p.cursors.value(dev, 0);
            int files = 0;
            for (const QString& name : QDir(devices.filePath(dev)).entryList({QStringLiteral("*.nchg")}, QDir::Files, QDir::Name)) {
                const auto match = fileRe.match(name);
                if (!match.hasMatch()) continue;
                const qint64 seq = match.captured(1).toLongLong();
                if (seq <= cursor) continue;
                if (seq != cursor + 1 || ++files > 200) break;  // one still on its way: wait for it
                QFile f(devices.filePath(dev + QLatin1Char('/') + name));
                if (!f.open(QIODevice::ReadOnly)) break;
                const auto plain = open(s.key, f.readAll(), QStringLiteral("%1/%2").arg(dev).arg(seq).toUtf8());
                if (!plain) break;  // half-copied, or not ours: try again next time
                const QJsonObject batch = QJsonDocument::fromJson(qUncompress(*plain)).object();
                for (const QJsonValue& r : batch.value(QStringLiteral("recs")).toArray())
                    p.records << Ledger::Incoming{dev, r.toObject()};
                cursor = seq;
            }
            p.cursors.insert(dev, cursor);
        }
        out << p;
    }
    return out;
}

void SyncEngine::pull()
{
    if (m_pulling || m_spaces.isEmpty()) return;
    m_pulling = true;
    m_reader.setFuture(QtConcurrent::run(&SyncEngine::read, m_spaces, m_me));
}

void SyncEngine::finishPull(const QList<Pulled>& pulled)
{
    m_pulling = false;
    QString unreachable;
    QSet<QString> own;
    if (const Space* lib = library())
        for (const QString& d : QDir(lib->root + QStringLiteral("/devices")).entryList(QDir::Dirs | QDir::NoDotAndDotDot)) own << d;

    QVariantList devices{QVariantMap{{"id", m_me}, {"name", m_ledger->deviceName()}, {"me", true}}};
    bool any = false;
    for (const Pulled& p : pulled) {
        if (!p.reachable) unreachable = p.space;
        if (!p.records.isEmpty()) any = true;
        bool isLibrary = false;
        for (const Space& s : m_spaces) isLibrary |= s.id == p.space && s.kind == u"library";
        if (isLibrary)
            for (auto it = p.names.begin(); it != p.names.end(); ++it)
                devices << QVariantMap{{"id", it.key()}, {"name", it.value()}, {"seen", p.seen.value(it.key())}, {"me", false}};
    }
    m_devices = devices;

    try {
        QStringList notes, attachments;
        if (any) {
            emit aboutToApply();
            m_ledger->capture();
        }
        for (const Pulled& p : pulled) {
            for (Space& s : m_spaces) {
                if (s.id != p.space) continue;
                if (!p.records.isEmpty()) {
                    const Ledger::Applied a = m_ledger->apply(s, p.records, own);
                    notes << QStringList(a.notes.begin(), a.notes.end());
                    attachments << a.attachments;
                }
                if (s.cursors != p.cursors) {
                    s.cursors = p.cursors;
                    m_ledger->saveSpace(s);
                }
            }
        }
        if (any) {
            m_ledger->capture();
            markSharedLists();
        }
        // Once per run (and after joining): images any note uses that aren't
        // here, say from a copy of the notes made without them.
        if (m_scanAttachments) {
            m_scanAttachments = false;
            static const QRegularExpression re(QStringLiteral("attachment:([A-Za-z0-9._-]+)"));
            for (const QVariant& v : m_db.conn().all(QStringLiteral("SELECT content FROM notes WHERE content LIKE '%attachment:%'")))
                for (auto it = re.globalMatch(v.toMap().value("content").toString()); it.hasNext();)
                    attachments << it.next().captured(1);
            attachments.removeDuplicates();
        }
        fetchAttachments(attachments);
        if (any) m_store.notifyExternal(notes);
    } catch (const db::Error& e) {
        qWarning() << "sync: applying changes failed:" << e.what();
        setStatus(QStringLiteral("error"), QString::fromUtf8(e.what()));
        return;
    }
    publish();
    if (!unreachable.isEmpty()) {
        for (const Space& s : m_spaces)
            if (s.id == unreachable)
                setStatus(QStringLiteral("unreachable"), QStringLiteral("Can’t reach %1").arg(QDir::toNativeSeparators(s.root)));
    }
}

void SyncEngine::publish()
{
    m_debounce.stop();
    m_firstPending = 0;
    if (m_spaces.isEmpty()) return;
    QString problem;
    try {
        m_ledger->capture();
        for (Space& s : m_spaces) {
            if (!QFileInfo::exists(s.root + QLatin1Char('/') + kMarker)) {
                problem = QStringLiteral("Can’t reach %1").arg(QDir::toNativeSeparators(s.root));
                continue;
            }
            const QString dir = s.root + QStringLiteral("/devices/") + m_me;
            QDir().mkpath(dir);
            for (int guard = 0; guard < 100; ++guard) {
                const Ledger::Outgoing out = m_ledger->outgoing(s);
                if (out.empty()) {
                    if (out.upTo > s.published) m_ledger->published(s, out);
                    break;
                }
                const qint64 seq = s.fileSeq + 1;
                const QJsonObject batch{{"v", 1}, {"dev", m_me}, {"seq", double(seq)}, {"recs", out.records}};
                const QByteArray data = seal(s.key, qCompress(QJsonDocument(batch).toJson(QJsonDocument::Compact), 6),
                                             QStringLiteral("%1/%2").arg(m_me).arg(seq).toUtf8());
                // Images first, so a note never arrives before its pictures.
                const QString attachDir = doc::attachmentDir();
                QDir().mkpath(s.root + QStringLiteral("/attachments"));
                for (const QString& name : out.attachments) {
                    const QString dst = s.root + QStringLiteral("/attachments/") + name;
                    QFile src(attachDir + QLatin1Char('/') + name);
                    if (QFileInfo::exists(dst) || !src.open(QIODevice::ReadOnly)) continue;
                    writeFile(dst, seal(s.key, src.readAll(), (QStringLiteral("att/") + name).toUtf8()));
                }
                if (!writeFile(dir + QStringLiteral("/%1.nchg").arg(seq, 8, 10, QLatin1Char('0')), data)) {
                    problem = QStringLiteral("Couldn’t write to %1").arg(QDir::toNativeSeparators(s.root));
                    break;
                }
                s.fileSeq = seq;
                m_ledger->published(s, out);
            }
        }
        const qint64 now = QDateTime::currentSecsSinceEpoch();
        if (now - m_metaAt > 60) {
            m_metaAt = now;
            for (const Space& s : m_spaces) writeMeta(s);
            m_ledger->prune();
        }
    } catch (const db::Error& e) {
        qWarning() << "sync: publishing failed:" << e.what();
        problem = QString::fromUtf8(e.what());
    }
    if (problem.isEmpty()) {
        m_lastSynced = QDateTime::currentDateTime();
        setStatus(QStringLiteral("idle"));
    } else {
        setStatus(problem.startsWith(u"Can") ? QStringLiteral("unreachable") : QStringLiteral("error"), problem);
    }
}

void SyncEngine::writeMeta(const Space& s)
{
    if (!QFileInfo::exists(s.root + QLatin1Char('/') + kMarker)) return;
    QJsonObject seen;
    for (auto it = s.cursors.begin(); it != s.cursors.end(); ++it) seen.insert(it.key(), double(it.value()));
    const QJsonObject meta{{"name", m_ledger->deviceName()}, {"at", QDateTime::currentDateTimeUtc().toString(Qt::ISODate)},
                           {"seen", seen}, {"last", double(s.fileSeq)}};
    const QString dir = s.root + QStringLiteral("/devices/") + m_me;
    QDir().mkpath(dir);
    writeFile(dir + QStringLiteral("/device.nmeta"),
              seal(s.key, QJsonDocument(meta).toJson(QJsonDocument::Compact), (m_me + QStringLiteral("/meta")).toUtf8()));
}

void SyncEngine::fetchAttachments(const QStringList& names)
{
    QSet<QString> want = m_missingAttachments;
    for (const QString& n : names) want.insert(n);
    m_missingAttachments.clear();
    if (want.isEmpty()) return;
    const QString attachDir = doc::attachmentDir();
    QDir().mkpath(attachDir);
    bool got = false;
    for (const QString& name : want) {
        const QString local = attachDir + QLatin1Char('/') + name;
        if (QFileInfo::exists(local)) continue;
        bool found = false;
        for (const Space& s : m_spaces) {
            QFile f(s.root + QStringLiteral("/attachments/") + name);
            if (!f.open(QIODevice::ReadOnly)) continue;
            if (const auto bytes = open(s.key, f.readAll(), (QStringLiteral("att/") + name).toUtf8())) {
                found = writeFile(local, *bytes);
                break;
            }
        }
        if (found) got = true;
        else m_missingAttachments.insert(name);
    }
    if (got) m_store.notifyExternal();
}

}  // namespace noted
