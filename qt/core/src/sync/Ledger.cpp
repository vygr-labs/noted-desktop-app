#include "noted/sync/Ledger.h"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDebug>
#include <QHostInfo>
#include <QJsonDocument>
#include <QRegularExpression>
#include <QSysInfo>
#include <QTimeZone>

#include <algorithm>

#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/Sqlite.h"
#include "noted/sync/Merge.h"

namespace noted::sync {

using db::Transaction;

namespace {

// What syncs, per table. Derived columns (content_plain), Electron's live-share
// columns (sync_id, sync_secret, is_shared, is_owner) and local-only settings
// stay put.
struct Def
{
    QString e, table, key;
    QStringList fields;
    QJsonObject defaults;  // for a row first seen through a partial record
    int order;             // apply order: what others point at comes first
};

QString nowText() { return QDateTime::currentDateTimeUtc().toString(QStringLiteral("yyyy-MM-dd HH:mm:ss")); }

const QList<Def>& defs()
{
    static const QList<Def> d = [] {
        QList<Def> l;
        l.append({"setting", "settings", "key", {"value"}, {}, 0});
        l.append({"list", "lists", "id",
                  {"name", "icon", "color", "sort_order", "created_at", "updated_at", "is_hidden"},
                  {{"name", "Untitled list"}, {"icon", "folder"}, {"color", "gray"}, {"sort_order", 0}, {"is_hidden", 0}},
                  1});
        l.append({"todo_list", "todo_lists", "id", {"name", "color", "sort_order", "created_at"},
                  {{"name", "To-dos"}, {"color", "gray"}, {"sort_order", 0}}, 1});
        l.append({"tag", "tags", "id", {"name", "color", "created_at"}, {{"name", "tag"}, {"color", "gray"}}, 2});
        l.append({"note", "notes", "id",
                  {"title", "content", "note_type", "list_id", "is_daily", "daily_date", "is_pinned", "is_trashed",
                   "created_at", "updated_at", "spellcheck", "is_locked"},
                  {{"title", "Untitled"}, {"note_type", "rich"}, {"is_daily", 0}, {"is_pinned", 0}, {"is_trashed", 0},
                   {"spellcheck", 1}, {"is_locked", 0}},
                  3});
        l.append({"note_tag", "note_tags", "", {"note_id", "tag_id"}, {}, 4});
        l.append({"todo", "todos", "id",
                  {"note_id", "text", "is_completed", "due_date", "source_daily_date", "sort_order", "created_at",
                   "updated_at", "todo_list_id", "description"},
                  {{"text", ""}, {"is_completed", 0}, {"sort_order", 0}}, 5});
        return l;
    }();
    return d;
}

const Def* def(const QString& e)
{
    for (const Def& d : defs())
        if (d.e == e) return &d;
    return nullptr;
}

// Settings that follow you between computers: the note-lock PIN.
const QStringList kSyncedSettings = {QStringLiteral("lock_pin_hash"), QStringLiteral("lock_pin_salt")};

QJsonObject toJson(const QVariantMap& m)
{
    QJsonObject o;
    for (auto it = m.begin(); it != m.end(); ++it) o.insert(it.key(), QJsonValue::fromVariant(it.value()));
    return o;
}

QVariant toSql(const QJsonValue& v)
{
    if (v.isNull() || v.isUndefined()) return {};
    if (v.isDouble()) {
        const double d = v.toDouble();
        if (d == double(qint64(d))) return qint64(d);
        return d;
    }
    if (v.isBool()) return v.toBool() ? 1 : 0;
    return v.toString();
}

bool same(const QJsonValue& a, const QJsonValue& b)
{
    if (a.isDouble() && b.isDouble()) return a.toDouble() == b.toDouble();
    if ((a.isNull() || a.isUndefined()) && (b.isNull() || b.isUndefined())) return true;
    return a == b;
}

QString maxClock(const QJsonObject& clocks)
{
    QString m;
    for (auto it = clocks.begin(); it != clocks.end(); ++it) m = std::max(m, it.value().toString());
    return m;
}

QStringList attachmentsIn(const QString& content)
{
    static const QRegularExpression re(QStringLiteral("attachment:([A-Za-z0-9._-]+)"));
    QStringList out;
    for (auto it = re.globalMatch(content); it.hasNext();) out << it.next().captured(1);
    out.removeDuplicates();
    return out;
}

QString j(const QJsonObject& o) { return QString::fromUtf8(QJsonDocument(o).toJson(QJsonDocument::Compact)); }
QJsonObject obj(const QString& s) { return QJsonDocument::fromJson(s.toUtf8()).object(); }

}  // namespace

QString contentHash(const QString& content)
{
    if (content.isEmpty()) return {};
    return QString::fromLatin1(QCryptographicHash::hash(content.toUtf8(), QCryptographicHash::Sha1).toHex().left(24));
}

// ── clock ─────────────────────────────────────────────────────────────────
// "<ms, 13 digits>.<counter, 4 hex>.<device>": sorts as text, never runs
// backwards here, and is always later than anything this computer has seen.

QString Clock::next()
{
    const qint64 ms = QDateTime::currentMSecsSinceEpoch();
    if (ms > m_ms) { m_ms = ms; m_counter = 0; }
    else ++m_counter;
    return QStringLiteral("%1.%2.%3").arg(m_ms, 13, 10, QLatin1Char('0')).arg(m_counter, 4, 16, QLatin1Char('0')).arg(m_device);
}

QString Clock::at(qint64 ms) const
{
    return QStringLiteral("%1.0000.%2").arg(std::max<qint64>(ms, 0), 13, 10, QLatin1Char('0')).arg(m_device);
}

void Clock::observe(const QString& hlc)
{
    const QStringList p = hlc.split(QLatin1Char('.'));
    if (p.size() < 2) return;
    const qint64 ms = p[0].toLongLong();
    const int counter = p[1].toInt(nullptr, 16);
    if (ms > m_ms) { m_ms = ms; m_counter = counter; }
    else if (ms == m_ms) m_counter = std::max(m_counter, counter);
}

// ── setup ─────────────────────────────────────────────────────────────────

Ledger::Ledger(Database& db, PlainFn plainOf)
    : m_db(db)
    , m_plainOf(std::move(plainOf))
{
}

void Ledger::install()
{
    auto& c = m_db.conn();
    c.exec(QStringLiteral(R"(
        CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS sync_dirty (entity TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (entity, id)) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS sync_state (entity TEXT NOT NULL, id TEXT NOT NULL, data TEXT, clocks TEXT,
            deleted INTEGER DEFAULT 0, del_clock TEXT, PRIMARY KEY (entity, id)) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS sync_journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, id TEXT,
            fields TEXT, hlc TEXT, del INTEGER DEFAULT 0, origin TEXT, only TEXT);
        CREATE TABLE IF NOT EXISTS sync_versions (note_id TEXT NOT NULL, hash TEXT NOT NULL, parents TEXT,
            content TEXT, at INTEGER);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_versions ON sync_versions (note_id, hash);
        CREATE TABLE IF NOT EXISTS sync_spaces (id TEXT PRIMARY KEY, kind TEXT, root TEXT, key BLOB, list_id TEXT,
            name TEXT, published INTEGER DEFAULT 0, file_seq INTEGER DEFAULT 0, cursors TEXT);
        CREATE TABLE IF NOT EXISTS sync_members (space TEXT NOT NULL, entity TEXT NOT NULL, id TEXT NOT NULL,
            PRIMARY KEY (space, entity, id)) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS sync_heads (space TEXT NOT NULL, note_id TEXT NOT NULL, hash TEXT,
            PRIMARY KEY (space, note_id)) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS sync_pending (n INTEGER PRIMARY KEY, space TEXT, device TEXT, rec TEXT, at INTEGER);
        CREATE TABLE IF NOT EXISTS sync_alias (entity TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT,
            PRIMARY KEY (entity, from_id)) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS sync_unresolved (entity TEXT NOT NULL, id TEXT NOT NULL, field TEXT NOT NULL,
            value TEXT, PRIMARY KEY (entity, id, field)) WITHOUT ROWID;
    )"));
    if (!c.hasColumn(QStringLiteral("sync_spaces"), QStringLiteral("snap_seq"))) {
        c.exec(QStringLiteral("ALTER TABLE sync_spaces ADD COLUMN snap_seq INTEGER DEFAULT 0"));
        c.exec(QStringLiteral("ALTER TABLE sync_spaces ADD COLUMN snap_at INTEGER DEFAULT 0"));
    }
    // Remote changes are written with sync_meta.applying = '1' inside their
    // transaction (nobody else ever sees it), so they aren't sent back out.
    const QString quiet = QStringLiteral("NOT EXISTS (SELECT 1 FROM sync_meta WHERE k = 'applying' AND v = '1')");
    for (const Def& d : defs()) {
        auto keyOf = [&](const char* row) {
            return d.e == u"note_tag" ? QStringLiteral("%1.note_id || '|' || %1.tag_id").arg(QLatin1String(row))
                                      : QStringLiteral("%1.%2").arg(QLatin1String(row), d.key);
        };
        for (const auto& [suffix, when, row] : {std::tuple{"ai", "INSERT", "NEW"}, std::tuple{"au", "UPDATE", "NEW"},
                                                std::tuple{"ad", "DELETE", "OLD"}}) {
            QString cond = quiet;
            if (d.e == u"setting")
                cond += QStringLiteral(" AND %1.key IN ('%2')").arg(QLatin1String(row), kSyncedSettings.join(QStringLiteral("','")));
            c.exec(QStringLiteral("CREATE TRIGGER IF NOT EXISTS sync_%1_%2 AFTER %3 ON %1 WHEN %4 BEGIN "
                                  "INSERT OR IGNORE INTO sync_dirty (entity, id) VALUES ('%5', %6); END")
                       .arg(d.table, QLatin1String(suffix), QLatin1String(when), cond, d.e, keyOf(row)));
        }
    }
    deviceId();
}

void Ledger::uninstall()
{
    for (const Def& d : defs())
        for (const char* s : {"ai", "au", "ad"})
            m_db.conn().exec(QStringLiteral("DROP TRIGGER IF EXISTS sync_%1_%2").arg(d.table, QLatin1String(s)));
}

bool Ledger::installed()
{
    return m_db.conn().scalar(QStringLiteral("SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name = 'sync_notes_au'")).toInt() > 0;
}

// A device is this database on this computer. A database copied to another
// computer becomes a new device there, so two never write the same folder.
QString Ledger::deviceId()
{
    auto& c = m_db.conn();
    const QString machine = QString::fromLatin1(QSysInfo::machineUniqueId().toHex());
    QString id = c.scalar(QStringLiteral("SELECT v FROM sync_meta WHERE k = 'device'")).toString();
    const QString was = c.scalar(QStringLiteral("SELECT v FROM sync_meta WHERE k = 'machine'")).toString();
    if (id.isEmpty() || (!was.isEmpty() && was != machine)) {
        id = Database::newId().left(8);
        c.run(QStringLiteral("INSERT OR REPLACE INTO sync_meta (k, v) VALUES ('device', ?)"), {id});
        c.run(QStringLiteral("INSERT OR REPLACE INTO sync_meta (k, v) VALUES ('machine', ?)"), {machine});
    }
    m_clock.setDevice(id);
    return id;
}

QString Ledger::deviceName()
{
    const QString n = QSysInfo::machineHostName();
    return n.isEmpty() ? QStringLiteral("This computer") : n;
}

QList<Space> Ledger::spaces()
{
    QList<Space> out;
    for (const QVariant& v : m_db.conn().all(QStringLiteral("SELECT * FROM sync_spaces ORDER BY kind DESC, name"))) {
        const QVariantMap m = v.toMap();
        Space s;
        s.id = m.value("id").toString();
        s.kind = m.value("kind").toString();
        s.root = m.value("root").toString();
        s.key = m.value("key").toByteArray();
        s.listId = m.value("list_id").toString();
        s.name = m.value("name").toString();
        s.published = m.value("published").toLongLong();
        s.fileSeq = m.value("file_seq").toLongLong();
        s.snapSeq = m.value("snap_seq").toLongLong();
        s.snapAt = m.value("snap_at").toLongLong();
        const QJsonObject cur = obj(m.value("cursors").toString());
        for (auto it = cur.begin(); it != cur.end(); ++it) s.cursors.insert(it.key(), qint64(it.value().toDouble()));
        out << s;
    }
    return out;
}

void Ledger::saveSpace(const Space& s)
{
    QJsonObject cur;
    for (auto it = s.cursors.begin(); it != s.cursors.end(); ++it) cur.insert(it.key(), double(it.value()));
    m_db.conn().run(QStringLiteral("INSERT OR REPLACE INTO sync_spaces (id, kind, root, key, list_id, name, published, file_seq, cursors, snap_seq, snap_at) "
                                   "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
                    {s.id, s.kind, s.root, s.key, s.listId.isEmpty() ? QVariant() : s.listId, s.name, s.published,
                     s.fileSeq, j(cur), s.snapSeq, s.snapAt});
}

void Ledger::removeSpace(const QString& id)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    c.run(QStringLiteral("DELETE FROM sync_spaces WHERE id = ?"), {id});
    for (const char* t : {"sync_members", "sync_heads", "sync_pending"})
        c.run(QStringLiteral("DELETE FROM %1 WHERE space = ?").arg(QLatin1String(t)), {id});
    c.run(QStringLiteral("DELETE FROM sync_journal WHERE only = ?"), {id});
    tx.commit();
}

// ── state, rows, versions ─────────────────────────────────────────────────

Ledger::State Ledger::state(const QString& e, const QString& id)
{
    const QVariantMap m = m_db.conn().one(
        QStringLiteral("SELECT data, clocks, deleted, del_clock FROM sync_state WHERE entity = ? AND id = ?"), {e, id});
    State s;
    if (m.isEmpty()) return s;
    s.exists = true;
    s.deleted = m.value("deleted").toInt() != 0;
    s.delClock = m.value("del_clock").toString();
    s.data = obj(m.value("data").toString());
    s.clocks = obj(m.value("clocks").toString());
    return s;
}

void Ledger::writeState(const QString& e, const QString& id, const State& st)
{
    m_db.conn().run(QStringLiteral("INSERT OR REPLACE INTO sync_state (entity, id, data, clocks, deleted, del_clock) VALUES (?, ?, ?, ?, ?, ?)"),
                    {e, id, j(st.data), j(st.clocks), st.deleted ? 1 : 0, st.delClock.isEmpty() ? QVariant() : st.delClock});
}

QJsonObject Ledger::readRow(const QString& e, const QString& id)
{
    const Def* d = def(e);
    if (!d) return {};
    auto& c = m_db.conn();
    if (e == u"note_tag") {
        const QStringList p = id.split(QLatin1Char('|'));
        if (p.size() != 2) return {};
        return toJson(c.one(QStringLiteral("SELECT note_id, tag_id FROM note_tags WHERE note_id = ? AND tag_id = ?"), {p[0], p[1]}));
    }
    if (e == u"setting" && !kSyncedSettings.contains(id)) return {};
    return toJson(c.one(QStringLiteral("SELECT %1 FROM %2 WHERE %3 = ?").arg(d->fields.join(QStringLiteral(", ")), d->table, d->key), {id}));
}

QString Ledger::contentOf(const QString& noteId, const QString& hash)
{
    if (hash.isEmpty()) return {};
    return m_db.conn().scalar(QStringLiteral("SELECT content FROM sync_versions WHERE note_id = ? AND hash = ?"), {noteId, hash}).toString();
}

void Ledger::storeVersion(const QString& noteId, const QString& hash, const QStringList& parents, const QString& content)
{
    if (hash.isEmpty()) return;
    QStringList ps = parents;
    ps.removeAll(QString());
    ps.removeAll(hash);
    m_db.conn().run(QStringLiteral("INSERT INTO sync_versions (note_id, hash, parents, content, at) VALUES (?, ?, ?, ?, ?) "
                                   "ON CONFLICT (note_id, hash) DO UPDATE SET content = COALESCE(sync_versions.content, excluded.content), at = excluded.at"),
                    {noteId, hash, ps.join(QLatin1Char(',')), content, QDateTime::currentSecsSinceEpoch()});
}

QStringList Ledger::parentsOf(const QString& noteId, const QString& hash)
{
    const QString p = m_db.conn().scalar(QStringLiteral("SELECT parents FROM sync_versions WHERE note_id = ? AND hash = ?"), {noteId, hash}).toString();
    return p.isEmpty() ? QStringList{} : p.split(QLatin1Char(','));
}

bool Ledger::isAncestor(const QString& noteId, const QString& older, const QString& newer)
{
    QStringList queue{newer};
    QSet<QString> seen;
    while (!queue.isEmpty() && seen.size() < 400) {
        const QString h = queue.takeFirst();
        if (seen.contains(h)) continue;
        seen.insert(h);
        for (const QString& p : parentsOf(noteId, h)) {
            if (p == older) return true;
            queue << p;
        }
    }
    return false;
}

QString Ledger::commonBase(const QString& noteId, const QString& a, const QStringList& bParents)
{
    QSet<QString> mine;
    QStringList queue{a};
    while (!queue.isEmpty() && mine.size() < 400) {
        const QString h = queue.takeFirst();
        if (mine.contains(h)) continue;
        mine.insert(h);
        queue << parentsOf(noteId, h);
    }
    queue = bParents;
    QSet<QString> seen;
    while (!queue.isEmpty() && seen.size() < 400) {
        const QString h = queue.takeFirst();
        if (seen.contains(h)) continue;
        seen.insert(h);
        if (mine.contains(h)) return h;
        queue << parentsOf(noteId, h);
    }
    return {};
}

QString Ledger::alias(const QString& e, const QString& id)
{
    if (e == u"note_tag") {
        const QStringList p = id.split(QLatin1Char('|'));
        if (p.size() != 2) return id;
        return alias(QStringLiteral("note"), p[0]) + QLatin1Char('|') + alias(QStringLiteral("tag"), p[1]);
    }
    if (e != u"note" && e != u"tag") return id;
    const QString to = m_db.conn().scalar(QStringLiteral("SELECT to_id FROM sync_alias WHERE entity = ? AND from_id = ?"), {e, id}).toString();
    return to.isEmpty() ? id : to;
}

void Ledger::setAlias(const QString& e, const QString& from, const QString& to)
{
    auto& c = m_db.conn();
    c.run(QStringLiteral("INSERT OR REPLACE INTO sync_alias (entity, from_id, to_id) VALUES (?, ?, ?)"), {e, from, to});
    c.run(QStringLiteral("UPDATE sync_alias SET to_id = ? WHERE entity = ? AND to_id = ?"), {to, e, from});
}

void Ledger::journal(const QString& e, const QString& id, const QStringList& fields, const QString& hlc, bool del,
                     const QString& origin, const QString& only)
{
    m_db.conn().run(QStringLiteral("INSERT INTO sync_journal (entity, id, fields, hlc, del, origin, only) VALUES (?, ?, ?, ?, ?, ?, ?)"),
                    {e, id, fields.join(QLatin1Char(',')), hlc, del ? 1 : 0, origin.isEmpty() ? QVariant() : origin,
                     only.isEmpty() ? QVariant() : only});
}

void Ledger::markDirty(const QString& e, const QString& id)
{
    m_db.conn().run(QStringLiteral("INSERT OR IGNORE INTO sync_dirty (entity, id) VALUES (?, ?)"), {e, id});
}

// ── capture ───────────────────────────────────────────────────────────────

int Ledger::capture(bool seeding)
{
    auto& c = m_db.conn();
    const QVariantList dirty = c.all(QStringLiteral("SELECT entity, id FROM sync_dirty"));
    if (dirty.isEmpty()) return 0;
    int made = 0;
    Transaction tx(c);
    for (const QVariant& v : dirty) {
        const QString e = v.toMap().value("entity").toString(), id = v.toMap().value("id").toString();
        c.run(QStringLiteral("DELETE FROM sync_dirty WHERE entity = ? AND id = ?"), {e, id});
        const Def* d = def(e);
        if (!d) continue;
        QJsonObject row = readRow(e, id);
        State st = state(e, id);
        if (row.isEmpty()) {
            if (st.exists && !st.deleted) {
                st.deleted = true;
                st.delClock = m_clock.next();
                writeState(e, id, st);
                journal(e, id, {}, st.delClock, true, {});
                ++made;
            }
            continue;
        }
        // A reference still waiting for its target reads as what it will be.
        for (const QVariant& u : c.all(QStringLiteral("SELECT field, value FROM sync_unresolved WHERE entity = ? AND id = ?"), {e, id}))
            row.insert(u.toMap().value("field").toString(), u.toMap().value("value").toString());
        QString body;
        if (e == u"note") {
            body = row.value(QStringLiteral("content")).toString();
            row.insert(QStringLiteral("content"), contentHash(body));
        }
        QStringList changed;
        const bool fresh = !st.exists || st.deleted;
        for (const QString& f : d->fields)
            if (fresh || !same(row.value(f), st.data.value(f))) changed << f;
        if (changed.isEmpty()) continue;
        QString h;
        if (seeding && !st.exists) {
            const QString when = row.value(QStringLiteral("updated_at")).toString().isEmpty()
                                     ? row.value(QStringLiteral("created_at")).toString()
                                     : row.value(QStringLiteral("updated_at")).toString();
            const QDateTime t = QDateTime::fromString(when, QStringLiteral("yyyy-MM-dd HH:mm:ss"));
            h = m_clock.at(t.isValid() ? QDateTime(t.date(), t.time(), QTimeZone::UTC).toMSecsSinceEpoch() : 0);
        } else {
            h = m_clock.next();
        }
        if (e == u"note" && changed.contains(u"content")) {
            const QString hash = row.value(QStringLiteral("content")).toString();
            // A merge made here already knows both its parents.
            QStringList parents = parentsOf(id, hash);
            if (parents.isEmpty() && !fresh) parents << st.data.value(QStringLiteral("content")).toString();
            storeVersion(id, hash, parents, body);
        }
        for (const QString& f : changed) {
            st.data.insert(f, row.value(f));
            st.clocks.insert(f, h);
        }
        st.exists = true;
        st.deleted = false;
        writeState(e, id, st);
        journal(e, id, fresh ? QStringList{QStringLiteral("*")} : changed, h, false, {});
        ++made;
    }
    tx.commit();
    return made;
}

void Ledger::seed(const Space& s)
{
    auto& c = m_db.conn();
    {
        Transaction tx(c);
        for (const Def& d : defs()) {
            if (d.e == u"note_tag")
                c.exec(QStringLiteral("INSERT OR IGNORE INTO sync_dirty SELECT 'note_tag', note_id || '|' || tag_id FROM note_tags"));
            else if (d.e == u"setting")
                c.exec(QStringLiteral("INSERT OR IGNORE INTO sync_dirty SELECT 'setting', key FROM settings WHERE key IN ('%1')")
                           .arg(kSyncedSettings.join(QStringLiteral("','"))));
            else
                c.exec(QStringLiteral("INSERT OR IGNORE INTO sync_dirty SELECT '%1', %2 FROM %3").arg(d.e, d.key, d.table));
        }
        tx.commit();
    }
    capture(true);
    Transaction tx(c);
    const QString h = m_clock.next();
    c.run(QStringLiteral("INSERT INTO sync_journal (entity, id, fields, hlc, del, only) "
                         "SELECT entity, id, '*', ?, 0, ? FROM sync_state WHERE deleted = 0"),
          {h, s.id});
    tx.commit();
}

// ── outgoing ──────────────────────────────────────────────────────────────

bool Ledger::memberOf(const Space& s, const QString& e, const QString& id, const QJsonObject& data)
{
    if (s.kind != u"list") return true;
    auto noteIn = [&](const QString& noteId) {
        return state(QStringLiteral("note"), noteId).data.value(QStringLiteral("list_id")).toString() == s.listId;
    };
    if (e == u"list") return id == s.listId;
    if (e == u"note") return data.value(QStringLiteral("list_id")).toString() == s.listId;
    if (e == u"note_tag") return noteIn(data.value(QStringLiteral("note_id")).toString());
    if (e == u"todo") return noteIn(data.value(QStringLiteral("note_id")).toString());
    if (e == u"tag")
        return m_db.conn().scalar(QStringLiteral("SELECT EXISTS (SELECT 1 FROM note_tags nt JOIN notes n ON n.id = nt.note_id "
                                                 "WHERE nt.tag_id = ? AND n.list_id = ?)"),
                                  {id, s.listId}).toBool();
    return false;
}

QJsonObject Ledger::record(const Space& s, const QString& e, const QString& id, const State& st,
                           const QSet<QString>& fields, Outgoing* out)
{
    const Def* d = def(e);
    QJsonObject f;
    QString h;
    for (const QString& name : d->fields) {
        if (!fields.contains(name)) continue;
        const QString clock = st.clocks.value(name).toString();
        f.insert(name, QJsonArray{st.data.value(name), clock});
        h = std::max(h, clock);
    }
    QJsonObject rec{{"e", e}, {"i", id}, {"h", h}, {"f", f}};
    if (fields.size() == d->fields.size()) rec.insert(QStringLiteral("full"), 1);
    if (e == u"note" && fields.contains(QStringLiteral("content"))) {
        const QString hash = st.data.value(QStringLiteral("content")).toString();
        QString body = contentOf(id, hash);
        if (body.isEmpty() && !hash.isEmpty()) {
            const QString live = m_db.conn().scalar(QStringLiteral("SELECT content FROM notes WHERE id = ?"), {id}).toString();
            if (contentHash(live) == hash) body = live;
        }
        QJsonObject cobj{{"p", QJsonArray::fromStringList(parentsOf(id, hash))}};
        const bool plain = st.data.value(QStringLiteral("note_type")).toString() == u"plain";
        // Just the blocks that changed since the version already in the
        // folder, when that's clearly smaller.
        const QString head = m_db.conn().scalar(QStringLiteral("SELECT hash FROM sync_heads WHERE space = ? AND note_id = ?"), {s.id, id}).toString();
        const QString headBody = head.isEmpty() || head == hash ? QString() : contentOf(id, head);
        bool asDelta = false;
        if (out && !headBody.isEmpty() && body.size() > 2048) {
            const Body from = splitBody(headBody, plain), to = splitBody(body, plain);
            if (from.exact && to.exact && from.head == to.head && from.tail == to.tail) {
                const QJsonArray ops = delta(from.blocks, to.blocks);
                if (QJsonDocument(ops).toJson(QJsonDocument::Compact).size() < body.size() * 6 / 10) {
                    cobj.insert(QStringLiteral("from"), head);
                    cobj.insert(QStringLiteral("ops"), ops);
                    asDelta = true;
                }
            }
        }
        if (!asDelta) cobj.insert(QStringLiteral("b"), body);
        rec.insert(QStringLiteral("c"), cobj);
        if (out) {
            out->heads.insert(id, hash);
            out->attachments << attachmentsIn(body);
        }
    }
    return rec;
}

Ledger::Outgoing Ledger::outgoing(const Space& s, qint64 maxBytes)
{
    Outgoing out;
    auto& c = m_db.conn();
    const QVariantList entries = c.all(
        QStringLiteral("SELECT seq, entity, id, fields FROM sync_journal WHERE seq > ? AND (only IS NULL OR only = ?) "
                       "AND (origin IS NULL OR origin <> ?) ORDER BY seq LIMIT 20000"),
        {s.published, s.id, s.id});
    out.upTo = s.published;
    // Several edits to one row since the last write go out as one record.
    QList<QPair<QString, QString>> order;
    QHash<QPair<QString, QString>, QSet<QString>> fields;
    qint64 bytes = 0;
    for (const QVariant& v : entries) {
        const QVariantMap m = v.toMap();
        const auto key = qMakePair(m.value("entity").toString(), m.value("id").toString());
        if (!fields.contains(key)) order << key;
        QSet<QString>& fs = fields[key];
        for (const QString& f : m.value("fields").toString().split(QLatin1Char(','), Qt::SkipEmptyParts)) fs.insert(f);
        bytes += 200;
        if (key.first == u"note" && (fs.contains(QStringLiteral("content")) || fs.contains(QStringLiteral("*"))))
            bytes += c.scalar(QStringLiteral("SELECT length(content) FROM notes WHERE id = ?"), {key.second}).toLongLong();
        out.upTo = m.value("seq").toLongLong();
        if (bytes > maxBytes) break;
    }
    for (const auto& key : order) {
        const auto& [e, id] = key;
        const Def* d = def(e);
        if (!d) continue;
        State st = state(e, id);
        const bool before = c.scalar(QStringLiteral("SELECT EXISTS (SELECT 1 FROM sync_members WHERE space = ? AND entity = ? AND id = ?)"),
                                     {s.id, e, id}).toBool();
        if (!st.exists || st.deleted) {
            if (before) {
                out.records.append(QJsonObject{{"e", e}, {"i", id}, {"h", st.delClock.isEmpty() ? m_clock.next() : st.delClock}, {"d", 1}});
                out.left << key;
            }
            continue;
        }
        const bool now = memberOf(s, e, id, st.data);
        if (now) {
            QSet<QString> fs = fields.value(key);
            if (!before || fs.contains(QStringLiteral("*"))) fs = QSet<QString>(d->fields.begin(), d->fields.end());
            out.records.append(record(s, e, id, st, fs, &out));
            if (!before) out.joined << key;
        } else if (before) {
            out.records.append(QJsonObject{{"e", e}, {"i", id}, {"h", m_clock.next()}, {"l", 1}});
            out.left << key;
        }
    }
    out.attachments.removeDuplicates();
    return out;
}

void Ledger::published(Space& s, const Outgoing& out)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    for (const auto& [e, id] : out.joined)
        c.run(QStringLiteral("INSERT OR IGNORE INTO sync_members (space, entity, id) VALUES (?, ?, ?)"), {s.id, e, id});
    for (const auto& [e, id] : out.left)
        c.run(QStringLiteral("DELETE FROM sync_members WHERE space = ? AND entity = ? AND id = ?"), {s.id, e, id});
    for (auto it = out.heads.begin(); it != out.heads.end(); ++it)
        c.run(QStringLiteral("INSERT OR REPLACE INTO sync_heads (space, note_id, hash) VALUES (?, ?, ?)"), {s.id, it.key(), it.value()});
    s.published = out.upTo;
    saveSpace(s);
    tx.commit();
}

// ── apply ─────────────────────────────────────────────────────────────────

void Ledger::writeRow(const QString& e, const QString& id, const QJsonObject& values, bool insert)
{
    const Def* d = def(e);
    auto& c = m_db.conn();
    if (e == u"note_tag") {
        const QStringList p = id.split(QLatin1Char('|'));
        c.run(QStringLiteral("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"), {p.value(0), p.value(1)});
        return;
    }
    if (e == u"setting") {
        c.run(QStringLiteral("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"),
              {id, toSql(values.value(QStringLiteral("value")))});
        return;
    }
    QJsonObject v = values;
    if (insert) {
        for (auto it = d->defaults.begin(); it != d->defaults.end(); ++it)
            if (!v.contains(it.key())) v.insert(it.key(), it.value());
        for (const char* t : {"created_at", "updated_at"})
            if (d->fields.contains(QLatin1String(t)) && !v.contains(QLatin1String(t))) v.insert(QLatin1String(t), nowText());
    }
    QStringList cols;
    QVariantList args;
    for (const QString& f : d->fields) {
        if (!v.contains(f)) continue;
        cols << f;
        args << toSql(v.value(f));
    }
    if (e == u"note" && v.contains(QStringLiteral("content"))) {
        const QString type = v.contains(QStringLiteral("note_type"))
                                 ? v.value(QStringLiteral("note_type")).toString()
                                 : c.scalar(QStringLiteral("SELECT note_type FROM notes WHERE id = ?"), {id}).toString();
        const QString body = v.value(QStringLiteral("content")).toString();
        cols << QStringLiteral("content_plain");
        args << (body.isEmpty() ? QVariant() : QVariant(m_plainOf(body, type == u"plain")));
    }
    if (insert) {
        cols.prepend(d->key);
        args.prepend(id);
        c.run(QStringLiteral("INSERT INTO %1 (%2) VALUES (%3)").arg(d->table, cols.join(QStringLiteral(", ")),
                                                                    QStringList(cols.size(), QStringLiteral("?")).join(QStringLiteral(", "))),
              args);
    } else if (!cols.isEmpty()) {
        QStringList sets;
        for (const QString& col : cols) sets << col + QStringLiteral(" = ?");
        args << id;
        c.run(QStringLiteral("UPDATE %1 SET %2 WHERE %3 = ?").arg(d->table, sets.join(QStringLiteral(", ")), d->key), args);
    }
}

void Ledger::deleteRow(const QString& e, const QString& id)
{
    const Def* d = def(e);
    auto& c = m_db.conn();
    if (e == u"note_tag") {
        const QStringList p = id.split(QLatin1Char('|'));
        c.run(QStringLiteral("DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?"), {p.value(0), p.value(1)});
        return;
    }
    if (e == u"note") c.run(QStringLiteral("DELETE FROM notes_fts WHERE note_id = ?"), {id});
    c.run(QStringLiteral("DELETE FROM %1 WHERE %2 = ?").arg(d->table, d->key), {id});
}

void Ledger::refreshSearch(const QString& noteId)
{
    auto& c = m_db.conn();
    c.run(QStringLiteral("DELETE FROM notes_fts WHERE note_id = ?"), {noteId});
    c.run(QStringLiteral("INSERT INTO notes_fts (note_id, title, content_plain) SELECT id, title, COALESCE(content_plain, '') "
                         "FROM notes WHERE id = ? AND is_trashed = 0"),
          {noteId});
}

// Two tags can't share a name. When one arrives with a name a different tag
// has here, the one with the smaller id stays and takes the other's notes;
// every computer picks the same one. Returns false when the arriving tag is
// the one folded away.
bool Ledger::resolveTagName(const QString& id, const QString& name, Applied& out)
{
    auto& c = m_db.conn();
    const QString other = c.scalar(QStringLiteral("SELECT id FROM tags WHERE name = ? AND id <> ?"), {name, id}).toString();
    if (other.isEmpty()) return true;
    out.tags = true;
    if (id > other) {
        setAlias(QStringLiteral("tag"), id, other);
        return false;
    }
    c.run(QStringLiteral("UPDATE tags SET name = name || char(1) || id WHERE id = ?"), {other});
    return true;  // the caller writes `id`; finishTag moves the notes over
}

// Two lists can't share a name either (NoteStore::listNamed), but they aren't
// folded together like tags: one may be a shared list, and folding would
// carry private notes into it. One takes a number instead ("Work 2"): the one
// that isn't shared, else the bigger id, so every computer picks the same
// one. The new name goes out as an edit made here.
void Ledger::resolveListName(const Space& s, const QString& id, Applied& out)
{
    auto& c = m_db.conn();
    const QVariantList all = c.all(QStringLiteral("SELECT id, name, COALESCE(is_shared, 0) AS is_shared FROM lists"));
    QHash<QString, QString> names;  // id → name
    QSet<QString> keys, shared;
    for (const QVariant& v : all) {
        const QVariantMap l = v.toMap();
        names.insert(l.value("id").toString(), l.value("name").toString());
        keys << NoteStore::listNameKey(l.value("name").toString());
        if (l.value("is_shared").toInt()) shared << l.value("id").toString();
    }
    if (s.kind == u"list") shared << s.listId;  // may not be marked yet on joining
    const QString key = NoteStore::listNameKey(names.value(id));
    QString other;
    for (auto it = names.cbegin(); it != names.cend() && !key.isEmpty(); ++it)
        if (it.key() != id && NoteStore::listNameKey(it.value()) == key) { other = it.key(); break; }
    if (other.isEmpty()) return;
    const bool a = shared.contains(id), b = shared.contains(other);
    const QString loser = a != b ? (a ? other : id) : std::max(id, other);
    const QString base = names.value(loser).simplified();
    int n = 2;
    while (keys.contains(NoteStore::listNameKey(base + QLatin1Char(' ') + QString::number(n)))) ++n;
    c.run(QStringLiteral("UPDATE lists SET name = ? WHERE id = ?"), {base + QLatin1Char(' ') + QString::number(n), loser});
    markDirty(QStringLiteral("list"), loser);
    out.lists = true;
}

// Two notes for the same day (one made here, one on another computer before
// they'd synced): the smaller id stays, with both days' text.
void Ledger::resolveDaily(const QString& id, Applied& out)
{
    auto& c = m_db.conn();
    const QVariantMap me = c.one(QStringLiteral("SELECT daily_date, is_daily, is_trashed FROM notes WHERE id = ?"), {id});
    if (me.isEmpty() || !me.value("is_daily").toInt() || me.value("is_trashed").toInt()) return;
    const QString other = c.scalar(QStringLiteral("SELECT id FROM notes WHERE is_daily = 1 AND daily_date = ? AND id <> ? AND is_trashed = 0 "
                                                  "ORDER BY id LIMIT 1"),
                                   {me.value("daily_date"), id}).toString();
    if (other.isEmpty()) return;
    const QString keep = std::min(id, other), drop = std::max(id, other);
    const QVariantMap k = c.one(QStringLiteral("SELECT content, note_type, created_at FROM notes WHERE id = ?"), {keep});
    const QVariantMap d = c.one(QStringLiteral("SELECT content, created_at FROM notes WHERE id = ?"), {drop});
    const QString kc = k.value("content").toString(), dc = d.value("content").toString();
    const bool keepFirst = k.value("created_at").toString() <= d.value("created_at").toString();
    const QString merged = mergeContent(nullptr, kc, dc, keepFirst, k.value("note_type").toString() == u"plain");
    if (merged != kc) {
        storeVersion(keep, contentHash(kc), {}, kc);
        storeVersion(keep, contentHash(dc), {}, dc);
        storeVersion(keep, contentHash(merged), {contentHash(kc), contentHash(dc)}, merged);
        writeRow(QStringLiteral("note"), keep, QJsonObject{{"content", merged}}, false);
        markDirty(QStringLiteral("note"), keep);
    }
    for (const QVariant& t : c.all(QStringLiteral("SELECT tag_id FROM note_tags WHERE note_id = ?"), {drop})) {
        const QString tag = t.toMap().value("tag_id").toString();
        c.run(QStringLiteral("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"), {keep, tag});
        markDirty(QStringLiteral("note_tag"), keep + QLatin1Char('|') + tag);
        markDirty(QStringLiteral("note_tag"), drop + QLatin1Char('|') + tag);
    }
    for (const QVariant& t : c.all(QStringLiteral("SELECT id FROM todos WHERE note_id = ?"), {drop}))
        markDirty(QStringLiteral("todo"), t.toMap().value("id").toString());
    c.run(QStringLiteral("UPDATE todos SET note_id = ? WHERE note_id = ?"), {keep, drop});
    deleteRow(QStringLiteral("note"), drop);
    markDirty(QStringLiteral("note"), drop);
    setAlias(QStringLiteral("note"), drop, keep);
    refreshSearch(keep);
    out.notes << keep << drop;
}

void Ledger::retryUnresolved(Applied& out)
{
    auto& c = m_db.conn();
    for (const QVariant& v : c.all(QStringLiteral("SELECT entity, id, field, value FROM sync_unresolved"))) {
        const QVariantMap m = v.toMap();
        const QString field = m.value("field").toString(), value = m.value("value").toString();
        const QString table = field == u"list_id" ? QStringLiteral("lists") : field == u"todo_list_id" ? QStringLiteral("todo_lists") : QStringLiteral("notes");
        if (!c.scalar(QStringLiteral("SELECT EXISTS (SELECT 1 FROM %1 WHERE id = ?)").arg(table), {value}).toBool()) continue;
        writeRow(m.value("entity").toString(), m.value("id").toString(), QJsonObject{{field, value}}, false);
        c.run(QStringLiteral("DELETE FROM sync_unresolved WHERE entity = ? AND id = ? AND field = ?"), {m.value("entity"), m.value("id"), field});
        if (m.value("entity").toString() == u"note") out.notes << m.value("id").toString();
        else out.todos = true;
    }
}

Ledger::Applied Ledger::apply(const Space& s, QList<Incoming> records, const QSet<QString>& ownDevices)
{
    Applied out;
    auto& c = m_db.conn();
    // Records that couldn't be used last time (a body's base hadn't arrived).
    for (const QVariant& v : c.all(QStringLiteral("SELECT device, rec FROM sync_pending WHERE space = ? ORDER BY n"), {s.id}))
        records << Incoming{v.toMap().value("device").toString(), obj(v.toMap().value("rec").toString())};
    if (records.isEmpty()) return out;
    std::stable_sort(records.begin(), records.end(), [](const Incoming& a, const Incoming& b) {
        const Def *da = def(a.record.value(QStringLiteral("e")).toString()), *db = def(b.record.value(QStringLiteral("e")).toString());
        const int oa = da ? da->order : 9, ob = db ? db->order : 9;
        if (oa != ob) return oa < ob;
        return a.record.value(QStringLiteral("h")).toString() < b.record.value(QStringLiteral("h")).toString();
    });

    Transaction tx(c);
    c.run(QStringLiteral("DELETE FROM sync_pending WHERE space = ?"), {s.id});
    c.exec(QStringLiteral("INSERT OR REPLACE INTO sync_meta (k, v) VALUES ('applying', '1')"));
    auto pend = [&](const Incoming& in) {
        c.run(QStringLiteral("INSERT INTO sync_pending (space, device, rec, at) VALUES (?, ?, ?, ?)"),
              {s.id, in.device, j(in.record), QDateTime::currentSecsSinceEpoch()});
    };
    auto touched = [&](const QString& e, const QString& id) {
        if (e == u"note") out.notes << id;
        else if (e == u"list") out.lists = true;
        else if (e == u"tag" || e == u"note_tag") out.tags = true;
        else if (e == u"todo" || e == u"todo_list") out.todos = true;
        else if (e == u"setting") out.settings = true;
    };

    for (const Incoming& in : records) {
        const QJsonObject& rec = in.record;
        const QString e = rec.value(QStringLiteral("e")).toString();
        const Def* d = def(e);
        if (!d || (e == u"setting" && s.kind != u"library")) continue;
        const QString rawId = rec.value(QStringLiteral("i")).toString();
        const QString id = alias(e, rawId);
        const QString h = rec.value(QStringLiteral("h")).toString();
        m_clock.observe(h);
        State st = state(e, id);

        // Left a shared list: it's gone for whoever only had it from there.
        if (rec.value(QStringLiteral("l")).toInt()) {
            c.run(QStringLiteral("DELETE FROM sync_members WHERE space = ? AND entity = ? AND id = ?"), {s.id, e, id});
            if (ownDevices.contains(in.device) || !st.exists || st.deleted) continue;
            deleteRow(e, id);
            st.deleted = true;
            st.delClock = h;
            writeState(e, id, st);
            journal(e, id, {}, h, true, s.id);
            touched(e, id);
            ++out.records;
            continue;
        }
        if (rec.value(QStringLiteral("d")).toInt()) {
            if (id != rawId) continue;  // folded into another row here; that one stays
            if (st.exists && !st.deleted && h > maxClock(st.clocks)) {
                deleteRow(e, id);
                st.deleted = true;
                st.delClock = h;
                writeState(e, id, st);
                journal(e, id, {}, h, true, s.id);
                touched(e, id);
                ++out.records;
            } else if (!st.exists) {
                st.exists = st.deleted = true;
                st.delClock = h;
                writeState(e, id, st);
            }
            continue;
        }

        const bool full = rec.value(QStringLiteral("full")).toInt();
        if (st.deleted && !(full && h > st.delClock)) continue;  // deleted here since
        const bool insert = !st.exists || st.deleted || readRow(e, id).isEmpty();
        if (st.deleted) { st.deleted = false; st.data = {}; st.clocks = {}; }

        const QJsonObject f = rec.value(QStringLiteral("f")).toObject();
        QJsonObject win;           // values to write
        QStringList changedFields; // for the journal
        bool merged = false;
        bool deferred = false;
        for (auto it = f.begin(); it != f.end(); ++it) {
            const QString name = it.key();
            if (!d->fields.contains(name)) continue;
            const QJsonArray pair = it.value().toArray();
            const QJsonValue value = pair.at(0);
            const QString clock = pair.at(1).toString();
            if (e == u"note" && name == u"content") {
                const QJsonObject cobj = rec.value(QStringLiteral("c")).toObject();
                const QString R = value.toString();
                const QString L = st.data.value(QStringLiteral("content")).toString();
                const QStringList P = [&] { QStringList l; for (const QJsonValue& p : cobj.value(QStringLiteral("p")).toArray()) l << p.toString(); return l; }();
                const bool plain = (f.contains(QStringLiteral("note_type")) ? f.value(QStringLiteral("note_type")).toArray().at(0).toString()
                                                                            : st.data.value(QStringLiteral("note_type")).toString()) == u"plain";
                QString body;
                if (cobj.contains(QStringLiteral("b"))) body = cobj.value(QStringLiteral("b")).toString();
                else if (!R.isEmpty()) {
                    const QString from = cobj.value(QStringLiteral("from")).toString();
                    const QString base = contentOf(id, from);
                    if (base.isEmpty()) { deferred = true; break; }
                    Body b = splitBody(base, plain);
                    QStringList blocks;
                    if (!applyDelta(b.blocks, cobj.value(QStringLiteral("ops")).toArray(), &blocks)) { deferred = true; break; }
                    b.blocks = blocks;
                    body = joinBody(b, plain);
                    if (contentHash(body) != R) { qWarning() << "sync: a note body didn't rebuild; waiting for a full copy"; deferred = true; break; }
                }
                storeVersion(id, R, P, body);
                c.run(QStringLiteral("INSERT OR REPLACE INTO sync_heads (space, note_id, hash) VALUES (?, ?, ?)"), {s.id, id, R});
                const QString mine = st.clocks.value(name).toString();
                if (R == L) {
                    st.clocks.insert(name, std::max(mine, clock));
                } else if (insert || L.isEmpty() || P.contains(L)) {
                    win.insert(name, body);
                    st.data.insert(name, R);
                    st.clocks.insert(name, std::max(mine, clock));
                    changedFields << name;
                } else if (isAncestor(id, R, L)) {
                    // Already part of what's here.
                } else {
                    // Edited here and there at once.
                    const QString baseHash = commonBase(id, L, P);
                    const QString baseBody = contentOf(id, baseHash);
                    const QString local = contentOf(id, L);
                    const bool localFirst = mine < clock;
                    const QString m = mergeContent(baseHash.isEmpty() ? nullptr : &baseBody, local, body, localFirst, plain);
                    const QString mh = contentHash(m);
                    if (mh == R) {
                        win.insert(name, body);
                        st.data.insert(name, R);
                        st.clocks.insert(name, std::max(mine, clock));
                        changedFields << name;
                    } else if (mh != L) {
                        storeVersion(id, mh, {L, R}, m);
                        win.insert(name, m);
                        merged = true;  // state keeps L, so the merge goes out as an edit made here
                    }
                }
                continue;
            }
            const QString mine = st.clocks.value(name).toString();
            if (insert || mine.isEmpty() || clock > mine) {
                win.insert(name, value);
                st.data.insert(name, value);
                st.clocks.insert(name, clock);
                changedFields << name;
            }
        }
        if (deferred) { pend(in); continue; }
        c.run(QStringLiteral("INSERT OR IGNORE INTO sync_members (space, entity, id) VALUES (?, ?, ?)"), {s.id, e, id});
        if (win.isEmpty() && !insert) { writeState(e, id, st); continue; }

        // References to rows that haven't arrived yet wait in sync_unresolved.
        auto hold = [&](const QString& field, const QString& table) {
            if (!win.contains(field) || win.value(field).isNull()) {
                if (win.contains(field)) c.run(QStringLiteral("DELETE FROM sync_unresolved WHERE entity = ? AND id = ? AND field = ?"), {e, id, field});
                return;
            }
            const QString target = alias(table == u"notes" ? QStringLiteral("note") : QString(), win.value(field).toString());
            win.insert(field, target);
            if (c.scalar(QStringLiteral("SELECT EXISTS (SELECT 1 FROM %1 WHERE id = ?)").arg(table), {target}).toBool()) {
                c.run(QStringLiteral("DELETE FROM sync_unresolved WHERE entity = ? AND id = ? AND field = ?"), {e, id, field});
                return;
            }
            c.run(QStringLiteral("INSERT OR REPLACE INTO sync_unresolved (entity, id, field, value) VALUES (?, ?, ?, ?)"), {e, id, field, target});
            win.insert(field, QJsonValue::Null);
        };
        if (e == u"note") hold(QStringLiteral("list_id"), QStringLiteral("lists"));
        if (e == u"todo") { hold(QStringLiteral("note_id"), QStringLiteral("notes")); hold(QStringLiteral("todo_list_id"), QStringLiteral("todo_lists")); }
        if (e == u"note_tag") {
            const QStringList p = id.split(QLatin1Char('|'));
            const bool ok = p.size() == 2
                && c.scalar(QStringLiteral("SELECT EXISTS (SELECT 1 FROM notes WHERE id = ?) AND EXISTS (SELECT 1 FROM tags WHERE id = ?)"), {p[0], p[1]}).toBool();
            if (!ok) { pend(in); continue; }
            st.data.insert(QStringLiteral("note_id"), p[0]);
            st.data.insert(QStringLiteral("tag_id"), p[1]);
        }
        QString foldedTag;
        if (e == u"tag" && win.contains(QStringLiteral("name"))) {
            const QString other = c.scalar(QStringLiteral("SELECT id FROM tags WHERE name = ? AND id <> ?"), {win.value(QStringLiteral("name")).toString(), id}).toString();
            if (!resolveTagName(id, win.value(QStringLiteral("name")).toString(), out)) {
                st.exists = st.deleted = true;
                st.delClock = h;
                writeState(e, id, st);
                continue;
            }
            foldedTag = other;
        }

        writeRow(e, id, win, insert);
        if (!foldedTag.isEmpty()) {
            for (const QVariant& t : c.all(QStringLiteral("SELECT note_id FROM note_tags WHERE tag_id = ?"), {foldedTag})) {
                const QString note = t.toMap().value("note_id").toString();
                c.run(QStringLiteral("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"), {note, id});
                markDirty(QStringLiteral("note_tag"), note + QLatin1Char('|') + id);
                markDirty(QStringLiteral("note_tag"), note + QLatin1Char('|') + foldedTag);
            }
            deleteRow(QStringLiteral("tag"), foldedTag);
            markDirty(QStringLiteral("tag"), foldedTag);
            setAlias(QStringLiteral("tag"), foldedTag, id);
        }
        // Fields the record didn't carry read as what's in the row now, with
        // no clock, so anything from elsewhere beats them and capture doesn't
        // mistake them for edits made here.
        if (insert) {
            const QJsonObject row = readRow(e, id);
            for (const QString& name : d->fields) {
                if (st.data.contains(name)) continue;
                st.data.insert(name, name == u"content" ? QJsonValue(contentHash(row.value(name).toString())) : row.value(name));
            }
        }
        st.exists = true;
        writeState(e, id, st);
        if (merged) markDirty(e, id);
        if (!changedFields.isEmpty() || insert) journal(e, id, insert ? QStringList{QStringLiteral("*")} : changedFields, h, false, s.id);
        if (e == u"note") {
            refreshSearch(id);
            if (win.contains(QStringLiteral("content"))) out.attachments << attachmentsIn(win.value(QStringLiteral("content")).toString());
            if (win.contains(QStringLiteral("is_daily")) || win.contains(QStringLiteral("daily_date")) || win.contains(QStringLiteral("is_trashed")))
                resolveDaily(id, out);
        }
        if (e == u"list" && (insert || win.contains(QStringLiteral("name")))) resolveListName(s, id, out);
        touched(e, id);
        ++out.records;
    }
    retryUnresolved(out);
    c.exec(QStringLiteral("UPDATE sync_meta SET v = '0' WHERE k = 'applying'"));
    tx.commit();
    out.attachments.removeDuplicates();
    return out;
}

// ── snapshots ─────────────────────────────────────────────────────────────

QJsonArray Ledger::snapshot(const Space& s)
{
    auto& c = m_db.conn();
    QJsonArray out;
    const QVariantList rows = s.kind == u"library"
        ? c.all(QStringLiteral("SELECT entity, id FROM sync_state"))
        : c.all(QStringLiteral("SELECT entity, id FROM sync_members WHERE space = ?"), {s.id});
    for (const QVariant& v : rows) {
        const QString e = v.toMap().value("entity").toString(), id = v.toMap().value("id").toString();
        const Def* d = def(e);
        if (!d || (e == u"setting" && s.kind != u"library")) continue;
        const State st = state(e, id);
        if (!st.exists) continue;
        if (st.deleted) {
            if (s.kind == u"library") out.append(QJsonObject{{"e", e}, {"i", id}, {"h", st.delClock}, {"d", 1}});
            continue;
        }
        if (!memberOf(s, e, id, st.data)) continue;
        out.append(record(s, e, id, st, QSet<QString>(d->fields.begin(), d->fields.end()), nullptr));
    }
    return out;
}

QSet<QString> Ledger::attachmentsUsed(const Space& s)
{
    QSet<QString> out;
    const QVariantList rows = s.kind == u"library"
        ? m_db.conn().all(QStringLiteral("SELECT content FROM notes WHERE content LIKE '%attachment:%'"))
        : m_db.conn().all(QStringLiteral("SELECT content FROM notes WHERE content LIKE '%attachment:%' AND list_id = ?"), {s.listId});
    for (const QVariant& v : rows)
        for (const QString& n : attachmentsIn(v.toMap().value("content").toString())) out.insert(n);
    return out;
}

// ── tidy ──────────────────────────────────────────────────────────────────

void Ledger::prune()
{
    auto& c = m_db.conn();
    Transaction tx(c);
    const QVariant low = c.scalar(QStringLiteral("SELECT min(published) FROM sync_spaces"));
    if (!low.isNull()) c.run(QStringLiteral("DELETE FROM sync_journal WHERE seq <= ?"), {low});
    const qint64 now = QDateTime::currentSecsSinceEpoch();
    // Old bodies are only merge bases. Keep the current one, the ones in the
    // folders, and the last few per note; past that keep just the lineage.
    c.run(QStringLiteral(
              "UPDATE sync_versions SET content = NULL WHERE content IS NOT NULL AND at < ? "
              "AND hash NOT IN (SELECT hash FROM sync_heads h WHERE h.note_id = sync_versions.note_id) "
              "AND hash NOT IN (SELECT json_extract(data, '$.content') FROM sync_state s WHERE s.entity = 'note' AND s.id = sync_versions.note_id) "
              "AND rowid NOT IN (SELECT rowid FROM sync_versions v WHERE v.note_id = sync_versions.note_id ORDER BY at DESC LIMIT 4)"),
          {now - 2 * 86400});
    c.run(QStringLiteral("DELETE FROM sync_versions WHERE content IS NULL AND at < ?"), {now - 90 * 86400});
    c.run(QStringLiteral("DELETE FROM sync_pending WHERE at < ?"), {now - 14 * 86400});
    tx.commit();
}

}  // namespace noted::sync
