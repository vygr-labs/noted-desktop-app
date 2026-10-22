#include <QSignalSpy>
#include <QTemporaryDir>
#include <QtTest>

#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/NotesModel.h"
#include "noted/Sqlite.h"

using namespace noted;

class TestStore : public QObject
{
    Q_OBJECT

private slots:
    void freshDatabaseIsAtLatestSchema();
    void notesListsTagsAndSearch();
    void dailyNoteIsReused();
    void savingUnchangedNoteKeepsItsTime();
    void listNamesAreUnique();
    void lockPin();
    void checklistProgressAndOpenTasks();
    void listGroupsAndSnippets();
    void tasksInEitherKeyOrder();
    void lockedNotesStayPrivate();
};

void TestStore::freshDatabaseIsAtLatestSchema()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    QCOMPARE(db.schemaVersion(), Database::kSchemaVersion);
}

void TestStore::notesListsTagsAndSearch()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    NotesModel model(store);

    const QVariantMap list = store.createList("Work");
    const QVariantMap n = store.createNote({{"title", "Quarterly plan"},
                                            {"content", R"({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"ship the roadmap"}]}]})"},
                                            {"list_id", list.value("id")}});
    QCOMPARE(n.value("content_plain").toString(), QStringLiteral("ship the roadmap"));
    model.refresh();
    QCOMPARE(model.count(), 1);

    QCOMPARE(store.search("roadm").size(), 1);
    QCOMPARE(store.search("quarter").size(), 1);

    store.addTagToNote(n.value("id").toString(), "Ideas");
    store.addTagToNote(n.value("id").toString(), "ideas");  // case-insensitive reuse
    QCOMPARE(store.tags().size(), 1);

    store.trashNote(n.value("id").toString());
    QCOMPARE(store.search("roadmap").size(), 0);
    model.refresh();
    QCOMPARE(model.count(), 0);
    store.restoreNote(n.value("id").toString());
    QCOMPARE(store.search("roadmap").size(), 1);

    store.deleteList(list.value("id").toString());
    QCOMPARE(store.counts().value("trash").toInt(), 1);
}

void TestStore::dailyNoteIsReused()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    const QVariantMap a = store.dailyNote("2026-09-30");
    const QVariantMap b = store.dailyNote("2026-09-30");
    QCOMPARE(a.value("id"), b.value("id"));
    QCOMPARE(a.value("title").toString(), QStringLiteral("Wednesday, September 30, 2026"));
}

void TestStore::savingUnchangedNoteKeepsItsTime()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    const QString content = R"({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"as it was"}]}]})";
    const QString id = store.createNote({{"title", "Old note"}, {"content", content}}).value("id").toString();
    db.conn().run(QStringLiteral("UPDATE notes SET updated_at = '2026-01-02 03:04:05' WHERE id = ?"), {id});

    QSignalSpy changed(&store, &NoteStore::notesChanged);
    store.updateNote(id, {{"content", content}, {"content_plain", "worded differently"}, {"title", "Old note"}});
    QCOMPARE(store.note(id).value("updated_at").toString(), QStringLiteral("2026-01-02 03:04:05"));
    QCOMPARE(changed.count(), 0);
    // A stale plain text is still brought up to date (search reads it).
    QCOMPARE(store.note(id).value("content_plain").toString(), QStringLiteral("worded differently"));
    QCOMPARE(store.search("worded").size(), 1);

    store.updateNote(id, {{"title", "New title"}});
    QVERIFY(store.note(id).value("updated_at").toString() != QStringLiteral("2026-01-02 03:04:05"));
}

void TestStore::listNamesAreUnique()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    const QString work = store.createList("  Work   notes ").value("id").toString();
    QCOMPARE(store.list(work).value("name").toString(), QStringLiteral("Work notes"));
    // Same name, other case and spacing: the existing list comes back.
    QCOMPARE(store.createList("work NOTES").value("id").toString(), work);
    QCOMPARE(store.lists().size(), 1);

    const QString home = store.createList("Home").value("id").toString();
    QVERIFY(store.updateList(home, {{"name", " WORK notes"}}).isEmpty());
    QCOMPARE(store.list(home).value("name").toString(), QStringLiteral("Home"));
    // Renaming a list to itself (or its own spelling) is fine.
    QCOMPARE(store.updateList(work, {{"name", "work notes"}}).value("name").toString(), QStringLiteral("work notes"));

    // Hidden lists still hold their name.
    store.setListHidden(home, true);
    QCOMPARE(store.listNamed("home").value("id").toString(), home);
    QVERIFY(store.listNamed("Home", home).isEmpty());
}

void TestStore::lockPin()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    QVERIFY(!store.hasLockPin());
    store.setLockPin("2468");
    QVERIFY(store.verifyLockPin("2468"));
    QVERIFY(!store.verifyLockPin("0000"));
    QVERIFY(store.removeLockPin("2468"));
    QVERIFY(!store.hasLockPin());
}
void TestStore::checklistProgressAndOpenTasks()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    NotesModel model(store);

    const QString content = QStringLiteral(
        R"({"type":"doc","content":[{"type":"taskList","content":[)"
        R"({"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"done one"}]}]},)"
        R"({"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"open one"}]},)"
        R"({"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"nested"}]}]}]}]}]}]})");
    const QVariantMap list = store.createList("Crater");
    const QString id = store.createNote({{"title", "Checklist"}, {"content", content}, {"list_id", list.value("id")}})
                           .value("id").toString();
    store.createNote({{"title", "Other"}});

    model.refresh();
    QCOMPARE(model.count(), 2);
    const int row = model.indexOf(id);
    QCOMPARE(model.data(model.index(row), NotesModel::TasksTotalRole).toInt(), 3);
    QCOMPARE(model.data(model.index(row), NotesModel::TasksDoneRole).toInt(), 1);
    QCOMPARE(model.data(model.index(row), NotesModel::ListNameRole).toString(), QStringLiteral("Crater"));
    QCOMPARE(model.data(model.index(row), NotesModel::GroupRole).toString(), QString());  // too few to group
    QCOMPARE(model.filterCounts().value("total").toInt(), 2);
    QCOMPARE(model.filterCounts().value("todos").toInt(), 1);
    QCOMPARE(model.filterCounts().value("daily").toInt(), 0);

    model.setFilter("todos");
    QCOMPARE(model.count(), 1);
    QCOMPARE(model.filterCounts().value("total").toInt(), 2);  // counts describe the unfiltered view

    const QVariantList groups = store.openTasks(list.value("id").toString());
    QCOMPARE(groups.size(), 1);
    const QVariantList items = groups.first().toMap().value("items").toList();
    QCOMPARE(items.size(), 2);
    QCOMPARE(items[0].toMap().value("text").toString(), QStringLiteral("open one"));
    QCOMPARE(items[0].toMap().value("index").toInt(), 1);
    QCOMPARE(items[1].toMap().value("text").toString(), QStringLiteral("nested"));
    QCOMPARE(items[1].toMap().value("index").toInt(), 2);

    // Ticking the nested item edits only its own flag.
    QVERIFY(store.setTaskChecked(id, 2, true));
    QString after = content;
    after.replace(after.lastIndexOf(QStringLiteral("\"checked\":false")), 15, QStringLiteral("\"checked\":true"));
    QCOMPARE(store.note(id).value("content").toString(), after);
    QCOMPARE(store.openTasks(list.value("id").toString()).first().toMap().value("items").toList().size(), 1);

    QVERIFY(store.setTaskChecked(id, 1, true));
    model.refresh();
    QCOMPARE(model.count(), 0);  // "Has to-dos" filter: nothing open anymore
    QVERIFY(!store.setTaskChecked(id, 7, true));
}

void TestStore::listGroupsAndSnippets()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    NotesModel model(store);

    const QString id = store.createNote({{"title", "Release plan"}, {"note_type", "plain"},
                                         {"content", "# Release plan\n\n- **Ship** the `v2` build\n- [x] tag it"}})
                           .value("id").toString();
    store.setPinned(id, true);
    model.refresh();
    QCOMPARE(model.data(model.index(0), NotesModel::GroupRole).toString(), QString());  // one note: no headings
    QCOMPARE(model.data(model.index(0), NotesModel::PreviewRole).toString(), QStringLiteral("Ship the v2 build tag it"));

    // From 15 notes up the list gets date headings.
    for (int i = 0; i < 14; ++i) store.createNote({{"title", QStringLiteral("Note %1").arg(i)}});
    model.refresh();
    QCOMPARE(model.count(), 15);
    QCOMPARE(model.data(model.index(0), NotesModel::GroupRole).toString(), QStringLiteral("Pinned"));
    QCOMPARE(model.data(model.index(1), NotesModel::GroupRole).toString(), QStringLiteral("Today"));
}

void TestStore::tasksInEitherKeyOrder()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);

    // As this build saves it: keys sorted, so "attrs" comes before "type".
    const QString sorted = QStringLiteral(
        R"({"content":[{"content":[)"
        R"({"attrs":{"checked":false},"content":[{"content":[{"text":"first","type":"text"}],"type":"paragraph"}],"type":"taskItem"},)"
        R"({"attrs":{"checked":false},"content":[{"content":[{"text":"second","type":"text"}],"type":"paragraph"}],"type":"taskItem"})"
        R"(],"type":"taskList"}],"type":"doc"})");
    const QString id = store.createNote({{"title", "Sorted"}, {"content", sorted}}).value("id").toString();
    QCOMPARE(store.allTasks().size(), 2);
    QCOMPARE(store.openTasks().size(), 1);

    QVERIFY(store.setTaskChecked(id, 1, true));
    QVERIFY(store.setTaskDue(id, 0, QStringLiteral("2026-10-21")));
    const QVariantList all = store.allTasks(true);
    QCOMPARE(all.size(), 2);
    QCOMPARE(all[0].toMap().value("due").toString(), QStringLiteral("2026-10-21"));
    QVERIFY(!all[0].toMap().value("checked").toBool());
    QVERIFY(all[1].toMap().value("checked").toBool());
    QVERIFY(store.setTaskDue(id, 0, QString()));
    QCOMPARE(store.allTasks(true)[0].toMap().value("due").toString(), QString());

    // TipTap's own order keeps the byte-level edit, due date and all.
    const QString tiptap = QStringLiteral(
        R"({"type":"doc","content":[{"type":"taskList","content":[)"
        R"({"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"call"}]}]}]}]})");
    const QString id2 = store.createNote({{"title", "TipTap"}, {"content", tiptap}}).value("id").toString();
    QVERIFY(store.setTaskDue(id2, 0, QStringLiteral("2026-10-17")));
    QVERIFY(store.note(id2).value("content").toString().contains(QStringLiteral(R"("attrs":{"checked":false,"due":"2026-10-17"})")));
    QVERIFY(store.setTaskChecked(id2, 0, true));
    QVERIFY(store.note(id2).value("content").toString().contains(QStringLiteral(R"("attrs":{"checked":true,"due":"2026-10-17"})")));

    // Adding to an empty daily note replaces its blank paragraph.
    const QString daily = store.dailyNote(QStringLiteral("2026-10-17")).value("id").toString();
    QCOMPARE(store.appendTask(daily, QStringLiteral("Buy milk")), 0);
    QCOMPARE(store.appendTask(daily, QStringLiteral("Call Tolu")), 1);
    const QVariantList blocks = store.previewBlocks(daily);
    QCOMPARE(blocks.size(), 2);
    QCOMPARE(blocks[0].toMap().value("t").toString(), QStringLiteral("task"));
    QCOMPARE(blocks[1].toMap().value("text").toString(), QStringLiteral("Call Tolu"));
}

void TestStore::lockedNotesStayPrivate()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    store.setLockPin("2468");

    const QString body = QStringLiteral(
        R"({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"the vault code is 4411"}]},)"
        R"({"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"rotate the vault key"}]}]}]}]})");
    const QString id = store.createNote({{"title", "Vault notes"}, {"content", body}}).value("id").toString();
    QVERIFY(store.toggleNoteLock(id));

    // Body text doesn't find it; the title does, with nothing of the body.
    QCOMPARE(store.searchNotes("4411").size(), 0);
    const QVariantList byTitle = store.searchNotes("vault");
    QCOMPARE(byTitle.size(), 1);
    QCOMPARE(byTitle[0].toMap().value("snippet").toString(), QString());
    QCOMPARE(byTitle[0].toMap().value("hits").toInt(), 1);
    QVERIFY(byTitle[0].toMap().value("is_locked").toBool());

    QVERIFY(store.previewBlocks(id).isEmpty());
    QVERIFY(store.allTasks(true).isEmpty());
    QCOMPARE(store.recentEdited(4, true)[0].toMap().value("preview").toString(), QString());

    // Unlocked for the session, it behaves like any note.
    store.markUnlocked(id);
    QCOMPARE(store.searchNotes("4411").size(), 1);
    QCOMPARE(store.previewBlocks(id).size(), 2);
    QCOMPARE(store.allTasks().size(), 1);
    store.relock(id);
    QVERIFY(store.previewBlocks(id).isEmpty());
}

QTEST_MAIN(TestStore)
#include "test_store.moc"
