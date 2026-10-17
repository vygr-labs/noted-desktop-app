#include <QSignalSpy>
#include <QTemporaryDir>
#include <QtTest>

#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/NotesModel.h"

using namespace noted;

class TestStore : public QObject
{
    Q_OBJECT

private slots:
    void freshDatabaseIsAtLatestSchema();
    void notesListsTagsAndSearch();
    void dailyNoteIsReused();
    void lockPin();
    void checklistProgressAndOpenTasks();
    void listGroupsAndSnippets();
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


QTEST_MAIN(TestStore)
#include "test_store.moc"
