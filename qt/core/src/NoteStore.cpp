#include "noted/NoteStore.h"

#include <QDate>
#include <QDir>
#include <QFileInfo>
#include <functional>
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

void NoteStore::notifyExternal(const QStringList& noteIds)
{
    for (const QString& id : noteIds) emit noteChanged(id);
    emit externalChange();
    emit notesChanged();
    emit listsChanged();
    emit tagsChanged();
    emit todosChanged();
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
    c.run(QStringLiteral("INSERT INTO notes (id, title, content, content_plain, note_type, list_id, is_daily, daily_date, spellcheck) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
          {id, title, content, plain, type, nullIfEmpty(data.value(QStringLiteral("list_id"))),
           data.value(QStringLiteral("is_daily")).toBool() ? 1 : 0, nullIfEmpty(data.value(QStringLiteral("daily_date"))),
           data.value(QStringLiteral("spellcheck")).toBool() ? 1 : 0});
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

void NoteStore::setSpellcheck(const QString& id, bool on)
{
    m_db.conn().run(QStringLiteral("UPDATE notes SET spellcheck = ? WHERE id = ?"), {on ? 1 : 0, id});
    emit noteChanged(id);
    emit notesChanged();
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
        {"locked", c.scalar(QStringLiteral("SELECT COUNT(*) FROM notes WHERE is_trashed = 0 AND is_locked = 1")).toInt()},
        {"todosOpen", c.scalar(QStringLiteral("SELECT COUNT(*) FROM todos WHERE is_completed = 0")).toInt()},
        {"todosToday", c.scalar(QStringLiteral("SELECT COUNT(*) FROM todos WHERE is_completed = 0 AND "
                                               "substr(due_date, 1, 10) <= ?"), {today}).toInt()},
    };
}

QVariantList NoteStore::noteRows(const QString& where, const QVariantList& args, const QString& order, int limit, bool withPreview)
{
    QVariantList rows = m_db.conn().all(
        QStringLiteral("SELECT n.id, n.title, n.note_type, n.list_id, n.is_pinned, n.is_locked, n.is_shared, n.is_daily, "
                       "n.daily_date, n.created_at, n.updated_at, %4 AS preview, "
                       "(SELECT group_concat(t.name, ' ') FROM note_tags nt JOIN tags t ON t.id = nt.tag_id "
                       " WHERE nt.note_id = n.id) AS tag_names "
                       "FROM notes n WHERE n.is_trashed = 0 AND %1 ORDER BY %2 LIMIT %3")
            .arg(where, order)
            .arg(limit)
            .arg(withPreview ? QStringLiteral("substr(COALESCE(n.content_plain, ''), 1, 400)") : QStringLiteral("''")),
        args);
    for (QVariant& v : rows) {
        QVariantMap m = v.toMap();
        // Nothing derived from a locked body leaves the store.
        if (m.value("is_locked").toBool() && !m_unlocked.contains(m.value("id").toString())) m.insert(QStringLiteral("preview"), QString());
        m.insert(QStringLiteral("tags"), m.value("tag_names").toString().split(u' ', Qt::SkipEmptyParts));
        m.remove(QStringLiteral("tag_names"));
        v = m;
    }
    return rows;
}

QVariantList NoteStore::notesInList(const QString& listId, const QString& sort, bool withPreview)
{
    const QString order = sort == u"title" ? QStringLiteral("n.is_pinned DESC, n.title COLLATE NOCASE ASC")
                                           : QStringLiteral("n.is_pinned DESC, n.updated_at DESC");
    return noteRows(QStringLiteral("n.list_id = ?"), {listId}, order, 2000, withPreview);
}

QVariantList NoteStore::notesWithTag(const QString& name)
{
    return noteRows(QStringLiteral("n.id IN (SELECT nt.note_id FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE t.name = ?)"),
                    {name}, QStringLiteral("n.updated_at DESC"), 500);
}

QVariantList NoteStore::treeNotes(const QString& listId, int limit)
{
    return noteRows(QStringLiteral("n.list_id = ?"), {listId}, QStringLiteral("n.is_pinned DESC, n.updated_at DESC"), limit, false);
}

QVariantList NoteStore::listSummaries()
{
    // The latest note in each list, from the index alone.
    return m_db.conn().all(QStringLiteral(
        "SELECT list_id, title, MAX(updated_at) AS updated_at FROM notes "
        "WHERE is_trashed = 0 AND list_id IS NOT NULL GROUP BY list_id"));
}

QVariantList NoteStore::pastDailyNotes(const QString& beforeIso, int limit)
{
    return noteRows(QStringLiteral("n.is_daily = 1 AND n.daily_date < ? AND COALESCE(n.content_plain, '') <> ''"), {beforeIso},
                    QStringLiteral("n.daily_date DESC"), limit);
}

QVariantList NoteStore::pinnedNotes()
{
    return noteRows(QStringLiteral("n.is_pinned = 1"), {}, QStringLiteral("n.updated_at DESC"), 50, false);
}

QVariantList NoteStore::recentEdited(int limit, bool includeDaily)
{
    return noteRows(includeDaily ? QStringLiteral("1") : QStringLiteral("n.is_daily = 0"), {}, QStringLiteral("n.updated_at DESC"), limit);
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

QVariantList NoteStore::searchNotes(const QString& query, int limit)
{
    const QString q = query.simplified();
    const QStringList words = q.split(QLatin1Char(' '), Qt::SkipEmptyParts);
    if (words.isEmpty()) return {};
    QStringList terms;
    for (QString w : words) {
        w.replace(QLatin1Char('"'), QStringLiteral("\"\""));
        terms << QStringLiteral("\"%1\"*").arg(w);
    }
    QVariantList rows;
    try {
        rows = m_db.conn().all(
            QStringLiteral("SELECT n.id, n.title, n.list_id, n.is_locked, n.is_daily, n.daily_date, n.updated_at, "
                           "COALESCE(n.content_plain, '') AS plain, "
                           "(SELECT group_concat(t.name, ' ') FROM note_tags nt JOIN tags t ON t.id = nt.tag_id "
                           " WHERE nt.note_id = n.id) AS tag_names "
                           "FROM notes_fts f JOIN notes n ON n.id = f.note_id "
                           "WHERE notes_fts MATCH ? AND n.is_trashed = 0 LIMIT 500"),
            {terms.join(QLatin1Char(' '))});
    } catch (const db::Error& e) {
        qWarning() << "search failed:" << e.what();
        return {};
    }
    const auto count = [](const QString& hay, const QString& needle) {
        int n = 0;
        for (int i = hay.indexOf(needle, 0, Qt::CaseInsensitive); i >= 0; i = hay.indexOf(needle, i + needle.size(), Qt::CaseInsensitive)) ++n;
        return n;
    };
    QVariantList out;
    for (const QVariant& v : rows) {
        const QVariantMap m = v.toMap();
        const QString id = m.value("id").toString();
        const QString title = m.value("title").toString();
        const bool locked = m.value("is_locked").toBool() && !m_unlocked.contains(id);
        const int inTitle = count(title, q);
        // A locked note is found by its title only, and nothing of its body leaves here.
        const QString plain = locked ? QString() : m.value("plain").toString();
        const int inBody = count(plain, q);
        if (locked && inTitle == 0) continue;
        // The text around the first match (or the start), cut at word boundaries.
        QString snippet;
        if (!locked) {
            int at = plain.indexOf(q, 0, Qt::CaseInsensitive);
            if (at < 0) at = plain.indexOf(words.first(), 0, Qt::CaseInsensitive);
            const QString flat = QString(plain).replace(QLatin1Char('\n'), QLatin1Char(' '));
            if (at < 0) snippet = flat.left(140);
            else {
                const int from = at > 60 ? flat.lastIndexOf(QLatin1Char(' '), at - 40) + 1 : 0;
                int to = flat.indexOf(QLatin1Char(' '), qMin(int(flat.size()), at + int(q.size()) + 110));
                if (to < 0) to = int(flat.size());
                snippet = (from > 0 ? QStringLiteral("…") : QString()) + flat.mid(from, to - from) + (to < flat.size() ? QStringLiteral("…") : QString());
            }
        }
        out << QVariantMap{{QStringLiteral("id"), id},
                           {QStringLiteral("title"), title},
                           {QStringLiteral("list_id"), m.value("list_id").toString()},
                           {QStringLiteral("is_locked"), locked},
                           {QStringLiteral("is_daily"), m.value("is_daily").toBool()},
                           {QStringLiteral("daily_date"), m.value("daily_date").toString()},
                           {QStringLiteral("updated_at"), m.value("updated_at")},
                           {QStringLiteral("tags"), m.value("tag_names").toString().split(u' ', Qt::SkipEmptyParts)},
                           {QStringLiteral("snippet"), snippet},
                           {QStringLiteral("in_title"), inTitle},
                           {QStringLiteral("hits"), inTitle + inBody}};
    }
    // Title matches first, then the notes that mention it most, then the newest.
    std::stable_sort(out.begin(), out.end(), [](const QVariant& a, const QVariant& b) {
        const QVariantMap x = a.toMap(), y = b.toMap();
        const bool tx = x.value("in_title").toInt() > 0, ty = y.value("in_title").toInt() > 0;
        if (tx != ty) return tx;
        if (x.value("hits").toInt() != y.value("hits").toInt()) return x.value("hits").toInt() > y.value("hits").toInt();
        return x.value("updated_at").toString() > y.value("updated_at").toString();
    });
    if (out.size() > limit) out.resize(limit);
    return out;
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

int countTasks(const QJsonObject& node)
{
    int n = node.value(QLatin1String("type")).toString() == u"taskItem" ? 1 : 0;
    for (const QJsonValue& c : node.value(QLatin1String("content")).toArray()) n += countTasks(c.toObject());
    return n;
}

// True when every task item's attrs start where kTaskMarker finds them (key
// order as TipTap writes it), so a byte-level edit is safe.
bool markersMatchTasks(const QString& content)
{
    int markers = 0;
    for (int pos = content.indexOf(kTaskMarker); pos >= 0; pos = content.indexOf(kTaskMarker, pos + 1)) ++markers;
    return markers > 0 && markers == countTasks(doc::parse(content));
}

// Lets `edit` change the attrs of the index-th task item, in document order.
bool editTaskAttrs(QJsonObject& node, int& counter, int index, const std::function<void(QJsonObject&)>& edit)
{
    if (node.value(QLatin1String("type")).toString() == u"taskItem" && counter++ == index) {
        QJsonObject attrs = node.value(QLatin1String("attrs")).toObject();
        edit(attrs);
        node.insert(QStringLiteral("attrs"), attrs);
        return true;
    }
    QJsonArray kids = node.value(QLatin1String("content")).toArray();
    for (int i = 0; i < kids.size(); ++i) {
        QJsonObject k = kids.at(i).toObject();
        if (editTaskAttrs(k, counter, index, edit)) {
            kids.replace(i, k);
            node.insert(QStringLiteral("content"), kids);
            return true;
        }
    }
    return false;
}

// Like collectTasks, but every item with its checked state and due date.
void collectAllTasks(const QJsonObject& node, int& counter, bool includeDone, QVariantList& out)
{
    if (node.value(QLatin1String("type")).toString() == u"taskItem") {
        const int index = counter++;
        const QJsonObject attrs = node.value(QLatin1String("attrs")).toObject();
        const bool checked = attrs.value(QLatin1String("checked")).toBool();
        if (!checked || includeDone) {
            QString text;
            const QJsonArray content = node.value(QLatin1String("content")).toArray();
            if (!content.isEmpty()) inlineText(content.first().toObject(), text);
            text = text.simplified();
            if (!text.isEmpty())
                out << QVariantMap{{QStringLiteral("index"), index}, {QStringLiteral("text"), text},
                                   {QStringLiteral("checked"), checked},
                                   {QStringLiteral("due"), attrs.value(QLatin1String("due")).toString()}};
        }
    }
    for (const QJsonValue& c : node.value(QLatin1String("content")).toArray())
        collectAllTasks(c.toObject(), counter, includeDone, out);
}

// Simplified top-level blocks for small renders.
void previewOf(const QJsonObject& node, int max, QVariantList& out)
{
    const auto add = [&](const QString& t, const QString& text, bool checked = false) {
        if (out.size() < max) out << QVariantMap{{QStringLiteral("t"), t}, {QStringLiteral("text"), text}, {QStringLiteral("checked"), checked}};
    };
    const auto textOf = [](const QJsonObject& n) {
        QString s;
        inlineText(n, s);
        return s.simplified();
    };
    for (const QJsonValue& v : node.value(QLatin1String("content")).toArray()) {
        if (out.size() >= max) return;
        const QJsonObject b = v.toObject();
        const QString type = b.value(QLatin1String("type")).toString();
        if (type == u"paragraph") add(QStringLiteral("p"), textOf(b));
        else if (type == u"heading") {
            const int level = qBound(1, b.value(QLatin1String("attrs")).toObject().value(QLatin1String("level")).toInt(1), 3);
            add(QStringLiteral("h%1").arg(level), textOf(b));
        } else if (type == u"bulletList" || type == u"orderedList" || type == u"taskList") {
            const QString t = type == u"bulletList" ? QStringLiteral("li") : type == u"orderedList" ? QStringLiteral("ol") : QStringLiteral("task");
            for (const QJsonValue& item : b.value(QLatin1String("content")).toArray()) {
                const QJsonObject it = item.toObject();
                const QJsonArray parts = it.value(QLatin1String("content")).toArray();
                add(t, parts.isEmpty() ? QString() : textOf(parts.first().toObject()),
                    it.value(QLatin1String("attrs")).toObject().value(QLatin1String("checked")).toBool());
            }
        } else if (type == u"blockquote") add(QStringLiteral("quote"), textOf(b));
        else if (type == u"codeBlock") add(QStringLiteral("code"), textOf(b));
        else if (type == u"horizontalRule") add(QStringLiteral("hr"), {});
        else if (type == u"table") add(QStringLiteral("table"), textOf(b));
    }
}

}  // namespace

QVariantList NoteStore::allTasks(bool includeDone)
{
    // Metadata first (from idx_notes_meta, no bodies); bodies only for notes
    // that changed since the last call. octet_length is read from the row
    // header, so it doesn't load the body either.
    const QVariantList rows = m_db.conn().all(QStringLiteral(
        R"(SELECT id, title, list_id, is_daily, daily_date, updated_at, is_locked,
                  updated_at || '/' || octet_length(content) AS stamp FROM notes
           WHERE is_trashed = 0 AND note_type = 'rich'
             AND (list_id IS NULL OR list_id NOT IN (SELECT id FROM lists WHERE is_hidden = 1))
           ORDER BY updated_at DESC)"));
    QStringList stale;
    QSet<QString> seen;
    for (const QVariant& v : rows) {
        const QVariantMap m = v.toMap();
        const QString id = m.value("id").toString();
        seen.insert(id);
        if (m.value("is_locked").toBool() && !m_unlocked.contains(id)) continue;
        const auto it = m_taskCache.constFind(id);
        if (it == m_taskCache.constEnd() || it->stamp != m.value("stamp").toString()) stale << id;
    }
    for (auto it = m_taskCache.begin(); it != m_taskCache.end();) {
        if (seen.contains(it.key())) ++it;
        else it = m_taskCache.erase(it);
    }
    for (int at = 0; at < stale.size(); at += 200) {
        const QStringList batch = stale.mid(at, 200);
        QVariantList args;
        for (const QString& id : batch) args << id;
        const QString marks = QStringList(batch.size(), QStringLiteral("?")).join(u',');
        const QVariantList bodies = m_db.conn().all(
            QStringLiteral("SELECT id, updated_at || '/' || octet_length(content) AS stamp, "
                           "CASE WHEN content LIKE '%\"type\":\"taskItem\"%' THEN content END AS content "
                           "FROM notes WHERE id IN (%1)").arg(marks), args);
        for (const QVariant& v : bodies) {
            const QVariantMap m = v.toMap();
            TaskCache entry{m.value("stamp").toString(), {}};
            const QString content = m.value("content").toString();
            if (!content.isEmpty()) {
                int counter = 0;
                collectAllTasks(doc::parse(content), counter, true, entry.items);
            }
            m_taskCache.insert(m.value("id").toString(), entry);
        }
    }
    QVariantList out;
    for (const QVariant& v : rows) {
        const QVariantMap m = v.toMap();
        const QString id = m.value("id").toString();
        if (m.value("is_locked").toBool() && !m_unlocked.contains(id)) continue;
        const auto it = m_taskCache.constFind(id);
        if (it == m_taskCache.constEnd()) continue;
        for (const QVariant& item : it->items) {
            QVariantMap t = item.toMap();
            if (!includeDone && t.value("checked").toBool()) continue;
            t.insert(QStringLiteral("noteId"), id);
            t.insert(QStringLiteral("title"), m.value("title"));
            t.insert(QStringLiteral("listId"), m.value("list_id").toString());
            t.insert(QStringLiteral("isDaily"), m.value("is_daily").toBool());
            t.insert(QStringLiteral("dailyDate"), m.value("daily_date").toString());
            t.insert(QStringLiteral("updatedAt"), m.value("updated_at"));
            out << t;
        }
    }
    return out;
}

bool NoteStore::setTaskDue(const QString& noteId, int index, const QString& isoDate)
{
    static const QRegularExpression kDue(QStringLiteral(R"(^,"due":"[^"]*")"));
    const QVariantMap n = note(noteId);
    if (n.isEmpty() || n.value("note_type").toString() != u"rich") return false;
    QString content = n.value("content").toString();
    if (!markersMatchTasks(content)) {
        QJsonObject d = doc::parse(content);
        int counter = 0;
        const bool found = editTaskAttrs(d, counter, index, [&](QJsonObject& a) {
            if (isoDate.isEmpty()) a.remove(QStringLiteral("due"));
            else a.insert(QStringLiteral("due"), isoDate);
        });
        if (!found) return false;
        updateNote(noteId, {{QStringLiteral("content"), doc::stringify(d)}});
        return true;
    }
    int pos = -1;
    for (int i = 0; i <= index; ++i) {
        pos = content.indexOf(kTaskMarker, pos + 1);
        if (pos < 0) return false;
    }
    int at = pos + int(kTaskMarker.size());
    at += content.mid(at, 4) == u"true" ? 4 : 5;
    const QRegularExpressionMatch existing = kDue.match(QStringView(content).mid(at));
    const QString attr = isoDate.isEmpty() ? QString() : QStringLiteral(R"(,"due":"%1")").arg(isoDate);
    content.replace(at, existing.hasMatch() ? int(existing.capturedLength()) : 0, attr);
    updateNote(noteId, {{QStringLiteral("content"), content}});
    return true;
}

int NoteStore::appendTask(const QString& noteId, const QString& text)
{
    const QVariantMap n = note(noteId);
    if (n.isEmpty() || n.value("note_type").toString() != u"rich" || text.trimmed().isEmpty()) return -1;
    QJsonObject d = doc::parse(n.value("content").toString());
    QJsonArray blocks = d.value(QLatin1String("content")).toArray();
    const QJsonObject item{
        {QStringLiteral("type"), QStringLiteral("taskItem")},
        {QStringLiteral("attrs"), QJsonObject{{QStringLiteral("checked"), false}}},
        {QStringLiteral("content"), QJsonArray{QJsonObject{
            {QStringLiteral("type"), QStringLiteral("paragraph")},
            {QStringLiteral("content"), QJsonArray{QJsonObject{{QStringLiteral("type"), QStringLiteral("text")},
                                                               {QStringLiteral("text"), text.trimmed()}}}}}}}};
    // A fresh note is one empty paragraph: replace it.
    const bool blank = blocks.size() == 1 && blocks.at(0).toObject().value(QLatin1String("content")).toArray().isEmpty()
                       && blocks.at(0).toObject().value(QLatin1String("type")).toString() == u"paragraph";
    if (blank) blocks = QJsonArray();
    QJsonObject last = blocks.isEmpty() ? QJsonObject() : blocks.last().toObject();
    if (last.value(QLatin1String("type")).toString() == u"taskList") {
        QJsonArray items = last.value(QLatin1String("content")).toArray();
        items.append(item);
        last.insert(QStringLiteral("content"), items);
        blocks.replace(blocks.size() - 1, last);
    } else {
        blocks.append(QJsonObject{{QStringLiteral("type"), QStringLiteral("taskList")}, {QStringLiteral("content"), QJsonArray{item}}});
    }
    d.insert(QStringLiteral("content"), blocks);
    const int index = countTasks(d) - 1;
    updateNote(noteId, {{QStringLiteral("content"), doc::stringify(d)}});
    return index;
}

QVariantList NoteStore::previewBlocks(const QString& noteId, int max)
{
    const QVariantMap meta = m_db.conn().one(
        QStringLiteral("SELECT is_locked, updated_at || '/' || octet_length(content) || '/' || ? AS stamp FROM notes WHERE id = ?"),
        {max, noteId});
    if (meta.isEmpty() || (meta.value("is_locked").toBool() && !m_unlocked.contains(noteId))) return {};
    const QString stamp = meta.value("stamp").toString();
    const auto hit = m_previewCache.constFind(noteId);
    if (hit != m_previewCache.constEnd() && hit->stamp == stamp) return hit->items;
    const QVariantMap n = m_db.conn().one(QStringLiteral("SELECT note_type, content FROM notes WHERE id = ?"), {noteId});
    QVariantList out;
    if (n.value("note_type").toString() == u"plain") {
        for (const QString& line : n.value("content").toString().split(u'\n')) {
            if (out.size() >= max) break;
            out << QVariantMap{{QStringLiteral("t"), QStringLiteral("p")}, {QStringLiteral("text"), line.trimmed()}};
        }
    } else {
        previewOf(doc::parse(n.value("content").toString()), max, out);
    }
    m_previewCache.insert(noteId, TaskCache{stamp, out});
    return out;
}

QVariantList NoteStore::openTasks(const QString& listId, int limit)
{
    QString where = QStringLiteral(
        R"(is_trashed = 0 AND is_locked = 0 AND note_type = 'rich' AND content LIKE '%"attrs":{"checked":false%')");
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
    // Notes last saved by this build have their JSON keys sorted, so the
    // marker isn't there: edit the parsed document instead.
    if (!markersMatchTasks(content)) {
        QJsonObject d = doc::parse(content);
        int counter = 0;
        if (!editTaskAttrs(d, counter, index, [&](QJsonObject& a) { a.insert(QStringLiteral("checked"), checked); })) return false;
        updateNote(noteId, {{QStringLiteral("content"), doc::stringify(d)}});
        return true;
    }
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

int NoteStore::removeUnusedAttachments(int minAgeDays)
{
    const QString dir = doc::attachmentDir();
    if (dir.isEmpty() || !QFileInfo::exists(dir)) return 0;
    static const QRegularExpression re(QStringLiteral("attachment:([A-Za-z0-9._-]+)"));
    QSet<QString> used;
    auto scan = [&](const QString& sql) {
        for (const QVariant& v : m_db.conn().all(sql))
            for (auto it = re.globalMatch(v.toMap().value(QStringLiteral("content")).toString()); it.hasNext();)
                used.insert(it.next().captured(1));
    };
    scan(QStringLiteral("SELECT content FROM notes WHERE content LIKE '%attachment:%'"));
    // Recent versions kept for sync merges can bring an image back.
    if (m_db.conn().scalar(QStringLiteral("SELECT count(*) FROM sqlite_master WHERE name = 'sync_versions'")).toInt())
        scan(QStringLiteral("SELECT content FROM sync_versions WHERE content LIKE '%attachment:%'"));
    const QDateTime before = QDateTime::currentDateTime().addDays(-minAgeDays);
    int removed = 0;
    for (const QFileInfo& f : QDir(dir).entryInfoList(QDir::Files))
        if (!used.contains(f.fileName()) && f.lastModified() < before && QFile::remove(f.filePath())) ++removed;
    if (removed) qInfo() << "removed" << removed << "unused images";
    return removed;
}

void NoteStore::adoptSpellcheckOptIn()
{
    if (setting(QStringLiteral("qt.spellcheckOptIn")) == u"1") return;
    m_db.conn().run(QStringLiteral("UPDATE notes SET spellcheck = 0 WHERE spellcheck <> 0"));
    setSetting(QStringLiteral("qt.spellcheckOptIn"), QStringLiteral("1"));
}

}  // namespace noted
