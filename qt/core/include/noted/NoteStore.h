#pragma once

// All note/list/tag/todo storage operations, exposed to QML.
//
// Row shapes match the Electron IPC layer (snake_case column names), so the
// SQL stays reviewable side by side with app/src/backend/database/*.ts.
// Every write emits the matching *Changed signal; external writes (noted-cli)
// arrive through Database::externalChange and re-emit all of them.

#include <QObject>
#include <QSet>
#include <QVariant>

namespace noted {

class Database;

class NoteStore : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool hasLockPin READ hasLockPin NOTIFY lockPinChanged)

public:
    explicit NoteStore(Database& db, QObject* parent = nullptr);

    // ── notes ────────────────────────────────────────────────────────
    Q_INVOKABLE QVariantMap note(const QString& id);
    Q_INVOKABLE QVariantMap createNote(const QVariantMap& data);
    // Partial update: any of title, content, content_plain, note_type,
    // list_id, is_pinned, spellcheck. Bumps updated_at and refreshes FTS.
    Q_INVOKABLE QVariantMap updateNote(const QString& id, const QVariantMap& data);
    Q_INVOKABLE void trashNote(const QString& id);
    Q_INVOKABLE void restoreNote(const QString& id);
    Q_INVOKABLE void deleteNotePermanently(const QString& id);
    Q_INVOKABLE int emptyTrash();
    Q_INVOKABLE QVariantMap duplicateNote(const QString& id);
    Q_INVOKABLE void setPinned(const QString& id, bool pinned);
    Q_INVOKABLE void moveToList(const QString& id, const QString& listId);  // "" = no list
    Q_INVOKABLE QVariantMap counts();  // all, synced, trash, todosOpen, todosToday
    Q_INVOKABLE QVariantList recentNotes(int limit = 8);
    // Note rows for lists and cards: id, title, note_type, list_id, is_pinned,
    // is_locked, is_shared, is_daily, daily_date, created_at, updated_at,
    // preview (first 400 chars of plain text, "" while locked), tags [names].
    // sort: updated_at | title. Pinned notes come first.
    Q_INVOKABLE QVariantList notesInList(const QString& listId, const QString& sort = QStringLiteral("updated_at"), bool withPreview = true);
    Q_INVOKABLE QVariantList pinnedNotes();
    // An open list's notes for the sidebar tree: no preview text.
    Q_INVOKABLE QVariantList treeNotes(const QString& listId, int limit);
    // [{list_id, title, updated_at}]: each list's most recently edited note.
    Q_INVOKABLE QVariantList listSummaries();
    // Daily notes with something written in them, newest first, before a date.
    Q_INVOKABLE QVariantList pastDailyNotes(const QString& beforeIso, int limit);
    Q_INVOKABLE QVariantList notesWithTag(const QString& name);
    Q_INVOKABLE QVariantList recentEdited(int limit = 4, bool includeDaily = false);

    // ── daily ────────────────────────────────────────────────────────
    Q_INVOKABLE QVariantMap dailyNote(const QString& isoDate);  // get or create
    Q_INVOKABLE QString todayIso() const;

    // ── search ───────────────────────────────────────────────────────
    // FTS5 prefix search. Snippets mark hits with \u0001 … \u0002 so QML
    // can style them without HTML-escaping user text.
    Q_INVOKABLE QVariantList search(const QString& query, int limit = 50);
    // The search page and quick find: notes whose title or text match, ranked
    // title matches first, then by mentions, then newest. [{id, title,
    // list_id, is_locked, is_daily, daily_date, updated_at, tags, snippet,
    // in_title, hits}]. A locked note matches by title only and its snippet
    // is empty.
    Q_INVOKABLE QVariantList searchNotes(const QString& query, int limit = 200);

    // ── lists ────────────────────────────────────────────────────────
    Q_INVOKABLE QVariantList lists();
    Q_INVOKABLE QVariantList hiddenLists();
    Q_INVOKABLE QVariantMap list(const QString& id);
    Q_INVOKABLE QVariantMap createList(const QString& name, const QString& icon = {}, const QString& color = {});
    Q_INVOKABLE QVariantMap updateList(const QString& id, const QVariantMap& data);
    Q_INVOKABLE void deleteList(const QString& id);
    Q_INVOKABLE void setListHidden(const QString& id, bool hidden);
    Q_INVOKABLE void reorderLists(const QStringList& ids);
    Q_INVOKABLE QVariantMap findOrCreateList(const QString& name);

    // ── tags ─────────────────────────────────────────────────────────
    Q_INVOKABLE QVariantList tags();
    Q_INVOKABLE QVariantList tagsForNote(const QString& noteId);
    Q_INVOKABLE QVariantMap addTagToNote(const QString& noteId, const QString& name);  // find-or-create
    Q_INVOKABLE void removeTagFromNote(const QString& noteId, const QString& tagId);
    Q_INVOKABLE void deleteTag(const QString& tagId);
    QHash<QString, QVariantList> tagsForNotes(const QStringList& noteIds);

    // ── todos ────────────────────────────────────────────────────────
    Q_INVOKABLE QVariantList todos(const QString& todoListId = {});  // "" = all
    Q_INVOKABLE QVariantMap createTodo(const QVariantMap& data);
    Q_INVOKABLE QVariantMap updateTodo(const QString& id, const QVariantMap& data);
    Q_INVOKABLE void deleteTodo(const QString& id);
    Q_INVOKABLE void reorderTodos(const QStringList& ids);
    Q_INVOKABLE int clearCompletedTodos(const QString& todoListId = {});
    Q_INVOKABLE QVariantList todoLists();
    Q_INVOKABLE QVariantMap createTodoList(const QString& name, const QString& color = {});
    Q_INVOKABLE QVariantMap updateTodoList(const QString& id, const QVariantMap& data);
    Q_INVOKABLE void deleteTodoList(const QString& id);

    // ── lock ─────────────────────────────────────────────────────────
    bool hasLockPin();
    Q_INVOKABLE void setLockPin(const QString& pin);
    Q_INVOKABLE bool verifyLockPin(const QString& pin);
    Q_INVOKABLE bool removeLockPin(const QString& pin);  // verifies first; unlocks all notes
    Q_INVOKABLE bool toggleNoteLock(const QString& id);  // returns new state
    // Session unlocks (memory only, like the Electron build).
    Q_INVOKABLE bool isUnlocked(const QString& id) const { return m_unlocked.contains(id); }
    Q_INVOKABLE void markUnlocked(const QString& id) { m_unlocked.insert(id); emit lockStateChanged(); }
    Q_INVOKABLE void relock(const QString& id) { m_unlocked.remove(id); emit lockStateChanged(); }

    // ── settings (key/value table) ───────────────────────────────────
    Q_INVOKABLE QString setting(const QString& key, const QString& fallback = {});
    Q_INVOKABLE void setSetting(const QString& key, const QString& value);

    // Unchecked checklist items in rich notes, grouped by note (most recently
    // edited first): [{noteId, title, items: [{index, text}]}]. `index` is the
    // task's position among all task items of that note. listId "" = every
    // note outside hidden lists. Locked notes are skipped.
    Q_INVOKABLE QVariantList openTasks(const QString& listId = {}, int limit = 60);
    // Flips the index-th task item of a note in place (a byte-level edit of
    // the stored JSON, so nothing else in the note is rewritten).
    Q_INVOKABLE bool setTaskChecked(const QString& noteId, int index, bool checked);
    // Every checklist item in rich notes outside hidden lists, flat and in
    // note order (most recently edited note first): [{noteId, title, listId,
    // isDaily, dailyDate, updatedAt, index, text, checked, due}]. `due` is the
    // item's ISO due date or "". Locked notes are left out until unlocked
    // this session. Done items only with includeDone.
    Q_INVOKABLE QVariantList allTasks(bool includeDone = false);
    // Sets or clears ("") a task item's due date, as a byte-level edit like
    // setTaskChecked.
    Q_INVOKABLE bool setTaskDue(const QString& noteId, int index, const QString& isoDate);
    // Adds an unticked to-do at the end of a rich note (joining a to-do list
    // that ends the note). Returns its task index, or -1.
    Q_INVOKABLE int appendTask(const QString& noteId, const QString& text);
    // The first `max` blocks of a note, simplified for small renders (list
    // sheets): [{t: p|h1|h2|h3|li|ol|task|quote|code|hr|table, text, checked}].
    // Empty for a locked note.
    Q_INVOKABLE QVariantList previewBlocks(const QString& noteId, int max = 9);
    // ISO dates ("2026-09-04") in the given month ("2026-09") that have a
    // non-empty daily note.
    Q_INVOKABLE QStringList dailyDates(const QString& yearMonth);

    // Plain-text extraction used for content_plain on every rich save.
    Q_INVOKABLE static QString plainFromContent(const QString& tiptapJson);

    Database& database() { return m_db; }

    // Someone else wrote to the database on our connection (sync): tell
    // everything bound to it, as for a write from noted-cli.
    void notifyExternal(const QStringList& noteIds = {});

signals:
    void notesChanged();
    void noteChanged(const QString& id);  // content/metadata of one note changed
    void listsChanged();
    void tagsChanged();
    void todosChanged();
    void lockPinChanged();
    void lockStateChanged();  // a note was unlocked or locked again this session
    void settingChanged(const QString& key, const QString& value);
    void externalChange();

private:
    // withPreview false skips the body text: the rest comes from idx_notes_meta.
    QVariantList noteRows(const QString& where, const QVariantList& args, const QString& order, int limit, bool withPreview = true);
    void ftsReplace(const QString& id, const QString& title, const QString& plain);
    void ftsDelete(const QString& id);
    QVariantMap todo(const QString& id);
    QVariantMap todoList(const QString& id);
    QVariantMap tag(const QString& id);

    Database& m_db;
    QSet<QString> m_unlocked;
    // allTasks() per note, keyed by edit time and body size, so a save only
    // re-reads the note it changed.
    struct TaskCache { QString stamp; QVariantList items; };
    QHash<QString, TaskCache> m_taskCache;
    QHash<QString, TaskCache> m_previewCache;   // previewBlocks(), same keys (max is always 9)
};

}  // namespace noted
