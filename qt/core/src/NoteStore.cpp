#include "noted/NoteStore.h"

#include <QDate>
#include <QDebug>
#include <QJsonArray>
#include <QJsonDocument>
#include <QLocale>
#include <QRegularExpression>

#include "noted/Sqlite.h"
#include "noted/Database.h"
#include "noted/PinHasher.h"
#include "noted/doc/Export.h"
#include "noted/doc/TipTap.h"

namespace noted {

using db::Transaction;

namespace {

const QString kNoteCols = QStringLiteral(
    "id, title, content, content_plain, note_type, list_id, is_daily, daily_date, is_pinned, is_trashed, "
    "spellcheck, sync_id, sync_secret, is_shared, is_locked, is_owner, created_at, updated_at");

QVariant nullIfEmpty(const QVariant& v)
{
    if (!v.isValid() || v.isNull()) return QVariant();
    if (v.typeId() == QMetaType::QString && v.toString().isEmpty()) return QVariant();
    return v;
}

}  // namespace

NoteStore::NoteStore(Database& db, QObject* parent)
    : QObject(parent)
    , m_db(db)
{
    connect(&m_db, &Database::externalChange, this, [this] {
        emit externalChange();
        emit notesChanged();
        emit listsChanged();
        emit tagsChanged();
        emit todosChanged();
    });
}

// ── notes ─────────────────────────────────────────────────────────────────

QVariantMap NoteStore::note(const QString& id)
{
    return m_db.conn().one(QStringLiteral("SELECT %1 FROM notes WHERE id = ?").arg(kNoteCols), {id});
}

void NoteStore::ftsReplace(const QString& id, const QString& title, const QString& plain)
{
    auto& c = m_db.conn();
    c.run(QStringLiteral("DELETE FROM notes_fts WHERE note_id = ?"), {id});
    c.run(QStringLiteral("INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)"), {id, title, plain});
}

void NoteStore::ftsDelete(const QString& id)
{
    m_db.conn().run(QStringLiteral("DELETE FROM notes_fts WHERE note_id = ?"), {id});
}

QVariantMap NoteStore::createNote(const QVariantMap& data)
{
    auto& c = m_db.conn();
    const QString id = Database::newId();
    QString title = data.value(QStringLiteral("title")).toString();
    if (title.isEmpty()) title = QStringLiteral("Untitled");
    const QString type = data.value(QStringLiteral("note_type")).toString() == u"plain" ? QStringLiteral("plain")
                                                                                         : QStringLiteral("rich");
    const QVariant content = nullIfEmpty(data.value(QStringLiteral("content")));
    QVariant plain = nullIfEmpty(data.value(QStringLiteral("content_plain")));
    if (!plain.isValid() && content.isValid())
        plain = type == u"rich" ? plainFromContent(content.toString()) : content.toString();

    Transaction tx(c);
    c.run(QStringLiteral("INSERT INTO notes (id, title, content, content_plain, note_type, list_id, is_daily, daily_date) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
          {id, title, content, plain, type, nullIfEmpty(data.value(QStringLiteral("list_id"))),
           data.value(QStringLiteral("is_daily")).toBool() ? 1 : 0, nullIfEmpty(data.value(QStringLiteral("daily_date")))});
    ftsReplace(id, title, plain.toString());
    tx.commit();
    emit notesChanged();
    return note(id);
}

QVariantMap NoteStore::updateNote(const QString& id, const QVariantMap& data)
{
    auto& c = m_db.conn();
    QVariantMap cur = note(id);
    if (cur.isEmpty()) return {};

    static const QStringList allowed = {QStringLiteral("title"),     QStringLiteral("content"),
                                        QStringLiteral("content_plain"), QStringLiteral("note_type"),
                                        QStringLiteral("list_id"),   QStringLiteral("is_pinned"),
                                        QStringLiteral("spellcheck")};
    bool metaOnly = true;
    for (auto it = data.begin(); it != data.end(); ++it) {
        if (!allowed.contains(it.key())) continue;
        QVariant v = it.value();
        if (it.key() == u"is_pinned" || it.key() == u"spellcheck") v = v.toBool() ? 1 : 0;
        if (it.key() == u"list_id") v = nullIfEmpty(v);
        if (it.key() == u"title" && v.toString().isEmpty()) v = QStringLiteral("Untitled");
        if (it.key() == u"content" || it.key() == u"content_plain" || it.key() == u"note_type") metaOnly = false;
        cur.insert(it.key(), v);
    }
    // Derive content_plain when only content was given.
    if (data.contains(QStringLiteral("content")) && !data.contains(QStringLiteral("content_plain"))) {
        const QString content = cur.value(QStringLiteral("content")).toString();
        cur.insert(QStringLiteral("content_plain"),
                   cur.value(QStringLiteral("note_type")).toString() == u"plain" ? content : plainFromContent(content));
    }

    Transaction tx(c);
    c.run(QStringLiteral("UPDATE notes SET title = ?, content = ?, content_plain = ?, note_type = ?, list_id = ?, "
                         "is_pinned = ?, spellcheck = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
          {cur.value("title"), cur.value("content"), cur.value("content_plain"), cur.value("note_type"),
           cur.value("list_id"), cur.value("is_pinned"), cur.value("spellcheck"), id});
    if (!cur.value(QStringLiteral("is_trashed")).toBool())
        ftsReplace(id, cur.value("title").toString(), cur.value("content_plain").toString());
    tx.commit();
    Q_UNUSED(metaOnly)
    emit noteChanged(id);
    emit notesChanged();
    return note(id);
}

void NoteStore::trashNote(const QString& id)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    c.run(QStringLiteral("UPDATE notes SET is_trashed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"), {id});
    ftsDelete(id);
    tx.commit();
    emit notesChanged();
}

void NoteStore::restoreNote(const QString& id)
{
    auto& c = m_db.conn();
    const QVariantMap n = note(id);
    if (n.isEmpty()) return;
    Transaction tx(c);
    // A note whose list was deleted comes back without a list.
    c.run(QStringLiteral("UPDATE notes SET is_trashed = 0, updated_at = CURRENT_TIMESTAMP, "
                         "list_id = CASE WHEN list_id IN (SELECT id FROM lists) THEN list_id ELSE NULL END WHERE id = ?"),
          {id});
    ftsReplace(id, n.value("title").toString(), n.value("content_plain").toString());
    tx.commit();
    emit notesChanged();
}

void NoteStore::deleteNotePermanently(const QString& id)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    ftsDelete(id);
    c.run(QStringLiteral("DELETE FROM notes WHERE id = ?"), {id});
    tx.commit();
    emit notesChanged();
}

int NoteStore::emptyTrash()
{
    auto& c = m_db.conn();
    Transaction tx(c);
    c.run(QStringLiteral("DELETE FROM notes_fts WHERE note_id IN (SELECT id FROM notes WHERE is_trashed = 1)"));
    const int n = c.run(QStringLiteral("DELETE FROM notes WHERE is_trashed = 1"));
    tx.commit();
    emit notesChanged();
    return n;
}

QVariantMap NoteStore::duplicateNote(const QString& id)
{
    const QVariantMap n = note(id);
    if (n.isEmpty()) return {};
    QVariantMap copy{{"title", n.value("title").toString() + QStringLiteral(" (copy)")},
                     {"content", n.value("content")},
                     {"content_plain", n.value("content_plain")},
                     {"note_type", n.value("note_type")},
                     {"list_id", n.value("list_id")}};
    const QVariantMap created = createNote(copy);
    for (const QVariant& t : tagsForNote(id))
        m_db.conn().run(QStringLiteral("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"),
                        {created.value("id"), t.toMap().value("id")});
    return created;
}

void NoteStore::setPinned(const QString& id, bool pinned)
{
    m_db.conn().run(QStringLiteral("UPDATE notes SET is_pinned = ? WHERE id = ?"), {pinned ? 1 : 0, id});
    emit noteChanged(id);
    emit notesChanged();
}

void NoteStore::moveToList(const QString& id, const QString& listId)
{
    m_db.conn().run(QStringLiteral("UPDATE notes SET list_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
                    {nullIfEmpty(listId), id});
    emit noteChanged(id);
    emit notesChanged();
}

QVariantMap NoteStore::counts()
{
    auto& c = m_db.conn();
    const QString today = todayIso();
    return {
        {"all", c.scalar(QStringLiteral("SELECT COUNT(*) FROM notes WHERE is_trashed = 0 AND (list_id IS NULL OR "
                                        "list_id NOT IN (SELECT id FROM lists WHERE is_hidden = 1))")).toInt()},
        {"synced", c.scalar(QStringLiteral("SELECT COUNT(*) FROM notes WHERE is_trashed = 0 AND is_shared = 1")).toInt()},
        {"trash", c.scalar(QStringLiteral("SELECT COUNT(*) FROM notes WHERE is_trashed = 1")).toInt()},
        {"todosOpen", c.scalar(QStringLiteral("SELECT COUNT(*) FROM todos WHERE is_completed = 0")).toInt()},
        {"todosToday", c.scalar(QStringLiteral("SELECT COUNT(*) FROM todos WHERE is_completed = 0 AND "
                                               "substr(due_date, 1, 10) <= ?"), {today}).toInt()},
    };
}

QVariantList NoteStore::recentNotes(int limit)
{
    return m_db.conn().all(QStringLiteral("SELECT id, title, note_type, list_id, updated_at FROM notes "
                                          "WHERE is_trashed = 0 ORDER BY updated_at DESC LIMIT ?"),
                           {limit});
}

// ── daily ─────────────────────────────────────────────────────────────────

QString NoteStore::todayIso() const
{
    return QDate::currentDate().toString(Qt::ISODate);
}

QVariantMap NoteStore::dailyNote(const QString& isoDate)
{
    const QVariantMap existing = m_db.conn().one(
        QStringLiteral("SELECT %1 FROM notes WHERE is_daily = 1 AND daily_date = ?").arg(kNoteCols), {isoDate});
    if (!existing.isEmpty()) return existing;
    const QDate d = QDate::fromString(isoDate, Qt::ISODate);
    const QString title = QLocale(QLocale::English).toString(d, QStringLiteral("dddd, MMMM d, yyyy"));
    return createNote({{"title", title}, {"is_daily", true}, {"daily_date", isoDate}, {"note_type", "rich"}});
}

// ── search ────────────────────────────────────────────────────────────────

QVariantList NoteStore::search(const QString& query, int limit)
{
    const QStringList words = query.simplified().split(QLatin1Char(' '), Qt::SkipEmptyParts);
    if (words.isEmpty()) return {};
    QStringList terms;
    for (QString w : words) {
        w.replace(QLatin1Char('"'), QStringLiteral("\"\""));
        terms << QStringLiteral("\"%1\"*").arg(w);
    }
    try {
        return m_db.conn().all(
            QStringLiteral("SELECT f.note_id AS note_id, n.title AS title, n.note_type AS note_type, n.list_id AS list_id, "
                           "n.is_locked AS is_locked, n.updated_at AS updated_at, "
                           "snippet(notes_fts, 2, char(1), char(2), '…', 24) AS snippet "
                           "FROM notes_fts f JOIN notes n ON n.id = f.note_id "
                           "WHERE notes_fts MATCH ? AND n.is_trashed = 0 "
                           "ORDER BY (f.title LIKE '%' || ? || '%') DESC, rank LIMIT ?"),
            {terms.join(QLatin1Char(' ')), query.trimmed(), limit});
    } catch (const db::Error& e) {
        qWarning() << "search failed:" << e.what();
        return {};
    }
}

// ── lists ─────────────────────────────────────────────────────────────────

QVariantList NoteStore::lists()
{
    return m_db.conn().all(QStringLiteral(
        "SELECT l.*, (SELECT COUNT(*) FROM notes n WHERE n.list_id = l.id AND n.is_trashed = 0) AS note_count "
        "FROM lists l WHERE l.is_hidden = 0 ORDER BY l.sort_order ASC, l.created_at ASC"));
}

QVariantList NoteStore::hiddenLists()
{
    return m_db.conn().all(QStringLiteral(
        "SELECT l.*, (SELECT COUNT(*) FROM notes n WHERE n.list_id = l.id AND n.is_trashed = 0) AS note_count "
        "FROM lists l WHERE l.is_hidden = 1 ORDER BY l.name ASC"));
}

QVariantMap NoteStore::list(const QString& id)
{
    return m_db.conn().one(QStringLiteral("SELECT * FROM lists WHERE id = ?"), {id});
}

QVariantMap NoteStore::createList(const QString& name, const QString& icon, const QString& color)
{
    auto& c = m_db.conn();
    const QString id = Database::newId();
    const int order = c.scalar(QStringLiteral("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM lists")).toInt();
    c.run(QStringLiteral("INSERT INTO lists (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)"),
          {id, name.trimmed(), icon.isEmpty() ? QStringLiteral("folder") : icon,
           color.isEmpty() ? QStringLiteral("gray") : color, order});
    emit listsChanged();
    return list(id);
}

QVariantMap NoteStore::findOrCreateList(const QString& name)
{
    const QVariantMap existing = m_db.conn().one(QStringLiteral("SELECT * FROM lists WHERE name = ? COLLATE NOCASE"), {name});
    return existing.isEmpty() ? createList(name) : existing;
}

QVariantMap NoteStore::updateList(const QString& id, const QVariantMap& data)
{
    QVariantMap cur = list(id);
    if (cur.isEmpty()) return {};
    for (const char* k : {"name", "icon", "color"})
        if (data.contains(k)) cur.insert(k, data.value(k));
    m_db.conn().run(QStringLiteral("UPDATE lists SET name = ?, icon = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
                    {cur.value("name"), cur.value("icon"), cur.value("color"), id});
    emit listsChanged();
    emit notesChanged();
    return list(id);
}

void NoteStore::deleteList(const QString& id)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    c.run(QStringLiteral("DELETE FROM notes_fts WHERE note_id IN (SELECT id FROM notes WHERE list_id = ? AND is_trashed = 0)"), {id});
    c.run(QStringLiteral("UPDATE notes SET is_trashed = 1, updated_at = CURRENT_TIMESTAMP WHERE list_id = ? AND is_trashed = 0"), {id});
    c.run(QStringLiteral("DELETE FROM lists WHERE id = ?"), {id});
    tx.commit();
    emit listsChanged();
    emit notesChanged();
}

void NoteStore::setListHidden(const QString& id, bool hidden)
{
    m_db.conn().run(QStringLiteral("UPDATE lists SET is_hidden = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
                    {hidden ? 1 : 0, id});
    emit listsChanged();
    emit notesChanged();
}

void NoteStore::reorderLists(const QStringList& ids)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    for (int i = 0; i < ids.size(); ++i)
        c.run(QStringLiteral("UPDATE lists SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"), {i, ids[i]});
    tx.commit();
    emit listsChanged();
}

// ── tags ──────────────────────────────────────────────────────────────────

QVariantList NoteStore::tags()
{
    return m_db.conn().all(QStringLiteral(
        "SELECT t.*, (SELECT COUNT(*) FROM note_tags nt JOIN notes n ON n.id = nt.note_id "
        "WHERE nt.tag_id = t.id AND n.is_trashed = 0) AS note_count FROM tags t ORDER BY t.name ASC"));
}

QVariantMap NoteStore::tag(const QString& id)
{
    return m_db.conn().one(QStringLiteral("SELECT * FROM tags WHERE id = ?"), {id});
}

QVariantList NoteStore::tagsForNote(const QString& noteId)
{
    return m_db.conn().all(QStringLiteral("SELECT t.* FROM tags t INNER JOIN note_tags nt ON nt.tag_id = t.id "
                                          "WHERE nt.note_id = ? ORDER BY t.name ASC"),
                           {noteId});
}

QHash<QString, QVariantList> NoteStore::tagsForNotes(const QStringList& noteIds)
{
    QHash<QString, QVariantList> out;
    if (noteIds.isEmpty()) return out;
    // One query for everything; the table is small.
    const QVariantList rows = m_db.conn().all(QStringLiteral(
        "SELECT nt.note_id AS note_id, t.id AS id, t.name AS name, t.color AS color "
        "FROM note_tags nt INNER JOIN tags t ON t.id = nt.tag_id ORDER BY t.name ASC"));
    const QSet<QString> wanted(noteIds.begin(), noteIds.end());
    for (const QVariant& r : rows) {
        const QVariantMap m = r.toMap();
        const QString nid = m.value("note_id").toString();
        if (wanted.contains(nid)) out[nid].append(m);
    }
    return out;
}

QVariantMap NoteStore::addTagToNote(const QString& noteId, const QString& name)
{
    const QString n = name.trimmed();
    if (n.isEmpty()) return {};
    auto& c = m_db.conn();
    QVariantMap t = c.one(QStringLiteral("SELECT * FROM tags WHERE name = ? COLLATE NOCASE"), {n});
    if (t.isEmpty()) {
        const QString id = Database::newId();
        c.run(QStringLiteral("INSERT INTO tags (id, name, color) VALUES (?, ?, 'gray')"), {id, n});
        t = tag(id);
    }
    c.run(QStringLiteral("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"), {noteId, t.value("id")});
    emit tagsChanged();
    emit noteChanged(noteId);
    emit notesChanged();
    return t;
}

void NoteStore::removeTagFromNote(const QString& noteId, const QString& tagId)
{
    m_db.conn().run(QStringLiteral("DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?"), {noteId, tagId});
    emit tagsChanged();
    emit noteChanged(noteId);
    emit notesChanged();
}

void NoteStore::deleteTag(const QString& tagId)
{
    m_db.conn().run(QStringLiteral("DELETE FROM tags WHERE id = ?"), {tagId});
    emit tagsChanged();
    emit notesChanged();
}

// ── todos ─────────────────────────────────────────────────────────────────

QVariantMap NoteStore::todo(const QString& id)
{
    return m_db.conn().one(QStringLiteral("SELECT * FROM todos WHERE id = ?"), {id});
}

QVariantList NoteStore::todos(const QString& todoListId)
{
    if (todoListId.isEmpty())
        return m_db.conn().all(QStringLiteral("SELECT * FROM todos ORDER BY is_completed ASC, sort_order ASC, created_at DESC"));
    return m_db.conn().all(
        QStringLiteral("SELECT * FROM todos WHERE todo_list_id = ? ORDER BY is_completed ASC, sort_order ASC, created_at ASC"),
        {todoListId});
}

QVariantMap NoteStore::createTodo(const QVariantMap& data)
{
    auto& c = m_db.conn();
    const QString text = data.value("text").toString().trimmed();
    if (text.isEmpty()) return {};
    const QString id = Database::newId();
    const int order = c.scalar(QStringLiteral("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todos")).toInt();
    c.run(QStringLiteral("INSERT INTO todos (id, text, note_id, todo_list_id, description, due_date, source_daily_date, sort_order) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
          {id, text, nullIfEmpty(data.value("note_id")), nullIfEmpty(data.value("todo_list_id")),
           nullIfEmpty(data.value("description")), nullIfEmpty(data.value("due_date")),
           nullIfEmpty(data.value("source_daily_date")), order});
    emit todosChanged();
    return todo(id);
}

QVariantMap NoteStore::updateTodo(const QString& id, const QVariantMap& data)
{
    QVariantMap cur = todo(id);
    if (cur.isEmpty()) return {};
    for (auto it = data.begin(); it != data.end(); ++it) {
        const QString k = it.key();
        if (k == u"is_completed") cur.insert(k, it.value().toBool() ? 1 : 0);
        else if (k == u"description" || k == u"due_date" || k == u"todo_list_id") cur.insert(k, nullIfEmpty(it.value()));
        else if (k == u"text" || k == u"sort_order") cur.insert(k, it.value());
    }
    m_db.conn().run(QStringLiteral("UPDATE todos SET text = ?, description = ?, is_completed = ?, due_date = ?, "
                                   "todo_list_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
                    {cur.value("text"), cur.value("description"), cur.value("is_completed"), cur.value("due_date"),
                     cur.value("todo_list_id"), cur.value("sort_order"), id});
    emit todosChanged();
    return todo(id);
}

void NoteStore::deleteTodo(const QString& id)
{
    m_db.conn().run(QStringLiteral("DELETE FROM todos WHERE id = ?"), {id});
    emit todosChanged();
}

void NoteStore::reorderTodos(const QStringList& ids)
{
    auto& c = m_db.conn();
    Transaction tx(c);
    for (int i = 0; i < ids.size(); ++i)
        c.run(QStringLiteral("UPDATE todos SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"), {i, ids[i]});
    tx.commit();
    emit todosChanged();
}

int NoteStore::clearCompletedTodos(const QString& todoListId)
{
    const int n = todoListId.isEmpty()
        ? m_db.conn().run(QStringLiteral("DELETE FROM todos WHERE is_completed = 1"))
        : m_db.conn().run(QStringLiteral("DELETE FROM todos WHERE is_completed = 1 AND todo_list_id = ?"), {todoListId});
    emit todosChanged();
    return n;
}

QVariantMap NoteStore::todoList(const QString& id)
{
    return m_db.conn().one(QStringLiteral("SELECT * FROM todo_lists WHERE id = ?"), {id});
}

QVariantList NoteStore::todoLists()
{
    return m_db.conn().all(QStringLiteral(
        "SELECT tl.*, (SELECT COUNT(*) FROM todos t WHERE t.todo_list_id = tl.id AND t.is_completed = 0) AS open_count "
        "FROM todo_lists tl ORDER BY tl.sort_order ASC, tl.created_at ASC"));
}

QVariantMap NoteStore::createTodoList(const QString& name, const QString& color)
{
    auto& c = m_db.conn();
    const QString id = Database::newId();
    const int order = c.scalar(QStringLiteral("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todo_lists")).toInt();
    c.run(QStringLiteral("INSERT INTO todo_lists (id, name, color, sort_order) VALUES (?, ?, ?, ?)"),
          {id, name.trimmed(), color.isEmpty() ? QStringLiteral("gray") : color, order});
    emit todosChanged();
    return todoList(id);
}

QVariantMap NoteStore::updateTodoList(const QString& id, const QVariantMap& data)
{
    QVariantMap cur = todoList(id);
    if (cur.isEmpty()) return {};
    for (const char* k : {"name", "color"})
        if (data.contains(k)) cur.insert(k, data.value(k));
    m_db.conn().run(QStringLiteral("UPDATE todo_lists SET name = ?, color = ? WHERE id = ?"),
                    {cur.value("name"), cur.value("color"), id});
    emit todosChanged();
    return todoList(id);
}

void NoteStore::deleteTodoList(const QString& id)
{
    m_db.conn().run(QStringLiteral("DELETE FROM todo_lists WHERE id = ?"), {id});
    emit todosChanged();
}

// ── lock ──────────────────────────────────────────────────────────────────

bool NoteStore::hasLockPin()
{
    return !setting(QStringLiteral("lock_pin_hash")).isEmpty();
}

void NoteStore::setLockPin(const QString& pin)
{
    const QString salt = newPinSalt();
    setSetting(QStringLiteral("lock_pin_hash"), hashPin(pin, salt));
    setSetting(QStringLiteral("lock_pin_salt"), salt);
    emit lockPinChanged();
}

bool NoteStore::verifyLockPin(const QString& pin)
{
    const QString hash = setting(QStringLiteral("lock_pin_hash"));
    const QString salt = setting(QStringLiteral("lock_pin_salt"));
    if (hash.isEmpty() || salt.isEmpty()) return false;
    return hashPin(pin, salt) == hash;
}

bool NoteStore::removeLockPin(const QString& pin)
{
    if (!verifyLockPin(pin)) return false;
    setSetting(QStringLiteral("lock_pin_hash"), {});
    setSetting(QStringLiteral("lock_pin_salt"), {});
    m_db.conn().run(QStringLiteral("UPDATE notes SET is_locked = 0"));
    emit lockPinChanged();
    emit notesChanged();
    return true;
}

bool NoteStore::toggleNoteLock(const QString& id)
{
    const bool locked = !note(id).value("is_locked").toBool();
    m_db.conn().run(QStringLiteral("UPDATE notes SET is_locked = ? WHERE id = ?"), {locked ? 1 : 0, id});
    if (!locked) m_unlocked.insert(id);
    else m_unlocked.remove(id);
    emit noteChanged(id);
    emit notesChanged();
    return locked;
}

// ── settings ──────────────────────────────────────────────────────────────

QString NoteStore::setting(const QString& key, const QString& fallback)
{
    const QVariant v = m_db.conn().scalar(QStringLiteral("SELECT value FROM settings WHERE key = ?"), {key});
    return v.isValid() && !v.isNull() ? v.toString() : fallback;
}

void NoteStore::setSetting(const QString& key, const QString& value)
{
    m_db.conn().run(QStringLiteral("INSERT INTO settings (key, value) VALUES (?, ?) "
                                   "ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
                    {key, value});
    emit settingChanged(key, value);
}

// ── checklist items inside notes ───────────────────────────────────────────

namespace {

const QString kTaskMarker = QStringLiteral(R"("type":"taskItem","attrs":{"checked":)");

void inlineText(const QJsonObject& node, QString& out)
{
    if (node.value(QLatin1String("type")).toString() == u"text") out += node.value(QLatin1String("text")).toString();
    else if (node.value(QLatin1String("type")).toString() == u"hardBreak") out += u' ';
    for (const QJsonValue& c : node.value(QLatin1String("content")).toArray()) inlineText(c.toObject(), out);
}

// Depth-first, in document order — the same order the task markers appear in
// the serialized JSON.
void collectTasks(const QJsonObject& node, int& counter, QVariantList& out)
{
    if (node.value(QLatin1String("type")).toString() == u"taskItem") {
        const int index = counter++;
        if (!node.value(QLatin1String("attrs")).toObject().value(QLatin1String("checked")).toBool()) {
            QString text;
            const QJsonArray content = node.value(QLatin1String("content")).toArray();
            if (!content.isEmpty()) inlineText(content.first().toObject(), text);
            text = text.simplified();
            if (!text.isEmpty()) out << QVariantMap{{QStringLiteral("index"), index}, {QStringLiteral("text"), text}};
        }
    }
    for (const QJsonValue& c : node.value(QLatin1String("content")).toArray()) collectTasks(c.toObject(), counter, out);
}

}  // namespace

QVariantList NoteStore::openTasks(const QString& listId, int limit)
{
    QString where = QStringLiteral(
        R"(is_trashed = 0 AND is_locked = 0 AND note_type = 'rich' AND content LIKE '%"type":"taskItem","attrs":{"checked":false}%')");
    QVariantList args;
    if (!listId.isEmpty()) {
        where += QStringLiteral(" AND list_id = ?");
        args << listId;
    } else {
        where += QStringLiteral(" AND (list_id IS NULL OR list_id NOT IN (SELECT id FROM lists WHERE is_hidden = 1))");
    }
    const QVariantList rows = m_db.conn().all(
        QStringLiteral("SELECT id, title, content FROM notes WHERE %1 ORDER BY updated_at DESC").arg(where), args);

    QVariantList out;
    int total = 0;
    for (const QVariant& v : rows) {
        const QVariantMap m = v.toMap();
        int counter = 0;
        QVariantList items;
        collectTasks(doc::parse(m.value("content").toString()), counter, items);
        if (items.isEmpty()) continue;
        if (total + items.size() > limit) items = items.mid(0, qMax(0, limit - total));
        if (items.isEmpty()) break;
        total += int(items.size());
        out << QVariantMap{{QStringLiteral("noteId"), m.value("id")},
                           {QStringLiteral("title"), m.value("title")},
                           {QStringLiteral("items"), items}};
        if (total >= limit) break;
    }
    return out;
}

bool NoteStore::setTaskChecked(const QString& noteId, int index, bool checked)
{
    const QVariantMap n = note(noteId);
    if (n.isEmpty() || n.value("note_type").toString() != u"rich") return false;
    QString content = n.value("content").toString();
    int pos = -1;
    for (int i = 0; i <= index; ++i) {
        pos = content.indexOf(kTaskMarker, pos + 1);
        if (pos < 0) return false;
    }
    const int at = pos + int(kTaskMarker.size());
    const bool cur = content.mid(at, 4) == u"true";
    if (cur == checked) return true;
    content.replace(at, cur ? 4 : 5, checked ? QStringLiteral("true") : QStringLiteral("false"));
    updateNote(noteId, {{QStringLiteral("content"), content}});
    return true;
}

QStringList NoteStore::dailyDates(const QString& yearMonth)
{
    QStringList out;
    const QVariantList rows = m_db.conn().all(
        QStringLiteral("SELECT daily_date FROM notes WHERE is_daily = 1 AND is_trashed = 0 AND daily_date LIKE ? "
                       "AND COALESCE(content_plain, '') <> '' ORDER BY daily_date"),
        {yearMonth + QStringLiteral("-%")});
    for (const QVariant& v : rows) out << v.toMap().value("daily_date").toString();
    return out;
}

QString NoteStore::plainFromContent(const QString& tiptapJson)
{
    return doc::toPlainText(doc::parse(tiptapJson));
}

}  // namespace noted
