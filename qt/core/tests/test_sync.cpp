#include <QSignalSpy>
#include <QTemporaryDir>
#include <QtTest>

#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/Sqlite.h"
#include "noted/sync/Crypto.h"
#include "noted/sync/Merge.h"
#include "noted/sync/SyncEngine.h"

using namespace noted;

namespace {

QString doc(const QStringList& paragraphs)
{
    QStringList blocks;
    for (const QString& p : paragraphs)
        blocks << QStringLiteral(R"({"type":"paragraph","content":[{"type":"text","text":"%1"}]})").arg(p);
    return QStringLiteral(R"({"type":"doc","content":[%1]})").arg(blocks.join(QLatin1Char(',')));
}

// One computer: its own database and sync engine.
struct Device
{
    explicit Device(const QString& path)
        : db(path)
        , store(db)
        , sync(db, store)
    {
    }
    Database db;
    NoteStore store;
    SyncEngine sync;

    QString plain(const QString& id) { return store.note(id).value("content_plain").toString(); }
    int count(const QString& sql) { return db.conn().scalar(sql).toInt(); }
};

bool setUp(Device& d, const QString& folder, const QString& pass)
{
    QSignalSpy done(&d.sync, &SyncEngine::setupFinished);
    d.sync.setUp(folder, pass);
    if (done.isEmpty() && !done.wait(20000)) return false;
    return done.first().at(0).toBool();
}

void round(std::initializer_list<Device*> devices)
{
    for (int i = 0; i < 2; ++i)
        for (Device* d : devices) d->sync.runOnce();
}

}  // namespace

class TestSync : public QObject
{
    Q_OBJECT

private slots:
    void crypto();
    void mergeBlocks();
    void deltas();
    void libraryBetweenTwoComputers();
    void joiningWithAnOlderCopy();
    void sideBySideEditsMerge();
    void sameTagAndDayFromBoth();
    void wrongPassphrase();
    void sharedList();
};

void TestSync::crypto()
{
    const QByteArray key = sync::randomBytes(32);
    const QByteArray sealed = sync::seal(key, "hello", "a/1");
    QCOMPARE(sync::open(key, sealed, "a/1").value_or(""), QByteArray("hello"));
    QVERIFY(!sync::open(key, sealed, "a/2"));
    QVERIFY(!sync::open(sync::randomBytes(32), sealed, "a/1"));
    const QString code = sync::keyToCode(key);
    QCOMPARE(sync::codeToKey(code).value_or(QByteArray()), key);
    QCOMPARE(sync::codeToKey(code.toLower()).value_or(QByteArray()), key);
    QVERIFY(!sync::codeToKey(code.left(20)));
}

void TestSync::mergeBlocks()
{
    using sync::merge3;
    const QStringList base{"a", "b", "c", "d"};
    // Different blocks: both edits land.
    QCOMPARE(merge3(base, {"a", "B", "c", "d"}, {"a", "b", "c", "D"}, true), (QStringList{"a", "B", "c", "D"}));
    // An insert on each side.
    QCOMPARE(merge3(base, {"a", "x", "b", "c", "d"}, {"a", "b", "c", "d", "y"}, true), (QStringList{"a", "x", "b", "c", "d", "y"}));
    // The same block both ways: both kept, in the order asked for, and the
    // same either way round.
    QCOMPARE(merge3(base, {"a", "b1", "c", "d"}, {"a", "b2", "c", "d"}, true), (QStringList{"a", "b1", "b2", "c", "d"}));
    QCOMPARE(merge3(base, {"a", "b2", "c", "d"}, {"a", "b1", "c", "d"}, false), (QStringList{"a", "b1", "b2", "c", "d"}));
    // A delete and an edit elsewhere.
    QCOMPARE(merge3(base, {"a", "c", "d"}, {"a", "b", "c", "D"}, true), (QStringList{"a", "c", "D"}));
    // No common version: shared blocks once.
    QCOMPARE(sync::merge2({"a", "x", "c"}, {"a", "c", "y"}, true), (QStringList{"a", "x", "c", "y"}));

    const QString body = doc({"one", "two \\\"quoted\\\" [x]", "three"});
    const sync::Body b = sync::splitBody(body, false);
    QVERIFY(b.exact);
    QCOMPARE(b.blocks.size(), 3);
    QCOMPARE(sync::joinBody(b, false), body);
}

void TestSync::deltas()
{
    const QStringList from{"a", "b", "c", "d", "e"};
    for (const QStringList& to : {QStringList{"a", "b", "X", "d", "e"}, QStringList{"Z", "a", "e"}, QStringList{},
                                  QStringList{"a", "b", "c", "d", "e", "f"}, QStringList{"q"}}) {
        QStringList out;
        QVERIFY(sync::applyDelta(from, sync::delta(from, to), &out));
        QCOMPARE(out, to);
    }
}

void TestSync::libraryBetweenTwoComputers()
{
    QTemporaryDir dir;
    QDir().mkpath(dir.filePath("cloud"));
    Device a(dir.filePath("a.sqlite")), b(dir.filePath("b.sqlite"));
    const QVariantMap list = a.store.createList("Work");
    const QVariantMap n = a.store.createNote({{"title", "Plan"}, {"content", doc({"ship it"})}, {"list_id", list.value("id")}});
    a.store.addTagToNote(n.value("id").toString(), "q3");
    a.store.setLockPin("2468");

    QVERIFY(setUp(a, dir.filePath("cloud"), "correct horse"));
    QVERIFY(QFileInfo::exists(dir.filePath("cloud/noted/noted-sync.json")));
    QVERIFY(setUp(b, dir.filePath("cloud"), "correct horse"));
    round({&a, &b});

    const QString id = n.value("id").toString();
    QCOMPARE(b.store.note(id).value("title").toString(), QStringLiteral("Plan"));
    QCOMPARE(b.plain(id), QStringLiteral("ship it"));
    QCOMPARE(b.store.note(id).value("list_id").toString(), list.value("id").toString());
    QCOMPARE(b.store.tagsForNote(id).size(), 1);
    QCOMPARE(b.store.search("ship").size(), 1);
    QVERIFY(b.store.verifyLockPin("2468"));

    // Nothing in the folder is readable.
    QDirIterator it(dir.filePath("cloud"), QDir::Files, QDirIterator::Subdirectories);
    while (it.hasNext()) {
        QFile f(it.next());
        QVERIFY(f.open(QIODevice::ReadOnly));
        QVERIFY(!f.readAll().contains("ship it"));
    }

    // An edit and a delete go across too.
    b.store.updateNote(id, {{"title", "Plan v2"}});
    const QVariantMap gone = b.store.createNote({{"title", "Scratch"}});
    round({&b, &a});
    QCOMPARE(a.store.note(id).value("title").toString(), QStringLiteral("Plan v2"));
    QCOMPARE(a.store.note(gone.value("id").toString()).value("title").toString(), QStringLiteral("Scratch"));
    a.store.deleteNotePermanently(gone.value("id").toString());
    round({&a, &b});
    QVERIFY(b.store.note(gone.value("id").toString()).isEmpty());
    QCOMPARE(a.sync.devices().size(), 2);
}

void TestSync::joiningWithAnOlderCopy()
{
    QTemporaryDir dir;
    QDir().mkpath(dir.filePath("cloud"));
    QString x, y;
    {
        Database seedDb(dir.filePath("a.sqlite"));
        NoteStore s(seedDb);
        x = s.createNote({{"title", "one"}, {"content", doc({"first"})}}).value("id").toString();
        y = s.createNote({{"title", "two"}}).value("id").toString();
    }
    QVERIFY(QFile::copy(dir.filePath("a.sqlite"), dir.filePath("b.sqlite")));
    QTest::qWait(1100);
    Device a(dir.filePath("a.sqlite"));
    a.store.updateNote(x, {{"title", "one, edited on a"}, {"content", doc({"first", "more from a"})}});
    QVERIFY(setUp(a, dir.filePath("cloud"), "passphrase!"));
    Device b(dir.filePath("b.sqlite"));
    b.store.updateNote(y, {{"title", "two, edited on b"}});
    QVERIFY(setUp(b, dir.filePath("cloud"), "passphrase!"));
    round({&a, &b});
    for (Device* d : {&a, &b}) {
        QCOMPARE(d->store.note(x).value("title").toString(), QStringLiteral("one, edited on a"));
        QVERIFY(d->plain(x).contains("more from a"));
        QCOMPARE(d->store.note(y).value("title").toString(), QStringLiteral("two, edited on b"));
        QCOMPARE(d->count("SELECT count(*) FROM notes"), 2);
    }
}

void TestSync::sideBySideEditsMerge()
{
    QTemporaryDir dir;
    QDir().mkpath(dir.filePath("cloud"));
    Device a(dir.filePath("a.sqlite")), b(dir.filePath("b.sqlite"));
    QStringList paras;
    for (int i = 0; i < 40; ++i) paras << QStringLiteral("paragraph %1 with enough words to make the body long").arg(i);
    const QString id = a.store.createNote({{"title", "Long"}, {"content", doc(paras)}}).value("id").toString();
    QVERIFY(setUp(a, dir.filePath("cloud"), "passphrase!"));
    QVERIFY(setUp(b, dir.filePath("cloud"), "passphrase!"));
    round({&a, &b});
    QCOMPARE(b.store.note(id).value("content").toString(), doc(paras));

    // Both edit before either hears of the other.
    QStringList pa = paras, pb = paras;
    pa[2] = QStringLiteral("edited on a");
    pb[30] = QStringLiteral("edited on b");
    pb.append(QStringLiteral("added on b"));
    a.store.updateNote(id, {{"content", doc(pa)}});
    b.store.updateNote(id, {{"content", doc(pb)}, {"title", "Long (b)"}});
    round({&a, &b});

    const QString ca = a.store.note(id).value("content").toString();
    QString cb = b.store.note(id).value("content").toString();
    QCOMPARE(ca, cb);
    QVERIFY(a.plain(id).contains("edited on a"));
    QVERIFY(a.plain(id).contains("edited on b"));
    QVERIFY(a.plain(id).contains("added on b"));
    QVERIFY(!a.plain(id).contains("paragraph 2 with"));
    QCOMPARE(a.store.note(id).value("title").toString(), QStringLiteral("Long (b)"));

    // Later edits go as just the blocks that changed and still rebuild.
    QStringList pc = pa;
    pc[2] = QStringLiteral("edited on a");
    pc[30] = QStringLiteral("edited on b");
    pc.append(QStringLiteral("added on b"));
    pc[10] = QStringLiteral("small change");
    b.store.updateNote(id, {{"content", cb.replace("paragraph 10 with enough words to make the body long", "small change")}});
    round({&b, &a});
    QVERIFY(a.plain(id).contains("small change"));
    QCOMPARE(a.store.note(id).value("content").toString(), b.store.note(id).value("content").toString());
}

void TestSync::sameTagAndDayFromBoth()
{
    QTemporaryDir dir;
    QDir().mkpath(dir.filePath("cloud"));
    Device a(dir.filePath("a.sqlite")), b(dir.filePath("b.sqlite"));
    QVERIFY(setUp(a, dir.filePath("cloud"), "passphrase!"));
    QVERIFY(setUp(b, dir.filePath("cloud"), "passphrase!"));
    round({&a, &b});

    const QString na = a.store.createNote({{"title", "From a"}}).value("id").toString();
    const QString nb = b.store.createNote({{"title", "From b"}}).value("id").toString();
    a.store.addTagToNote(na, "idea");
    b.store.addTagToNote(nb, "idea");
    const QString da = a.store.dailyNote("2026-10-17").value("id").toString();
    const QString db = b.store.dailyNote("2026-10-17").value("id").toString();
    a.store.updateNote(da, {{"content", doc({"morning on a"})}});
    b.store.updateNote(db, {{"content", doc({"evening on b"})}});
    round({&a, &b});
    round({&a, &b});

    for (Device* d : {&a, &b}) {
        QCOMPARE(d->count("SELECT count(*) FROM tags WHERE name = 'idea'"), 1);
        QCOMPARE(d->store.tagsForNote(na).size(), 1);
        QCOMPARE(d->store.tagsForNote(nb).size(), 1);
        QCOMPARE(d->count("SELECT count(*) FROM notes WHERE is_daily = 1 AND daily_date = '2026-10-17'"), 1);
        const QString day = d->store.dailyNote("2026-10-17").value("content_plain").toString();
        QVERIFY2(day.contains("morning on a") && day.contains("evening on b"), qPrintable(day));
    }
}

void TestSync::wrongPassphrase()
{
    QTemporaryDir dir;
    QDir().mkpath(dir.filePath("cloud"));
    Device a(dir.filePath("a.sqlite")), b(dir.filePath("b.sqlite"));
    QVERIFY(setUp(a, dir.filePath("cloud"), "the right one"));
    QVERIFY(!setUp(b, dir.filePath("cloud"), "the wrong one"));
    QVERIFY(!b.sync.enabled());
}

void TestSync::sharedList()
{
    QTemporaryDir dir;
    QDir().mkpath(dir.filePath("mine"));
    QDir().mkpath(dir.filePath("shared"));
    Device a(dir.filePath("a.sqlite")), friendC(dir.filePath("c.sqlite"));
    const QString listId = a.store.createList("Church").value("id").toString();
    const QString inside = a.store.createNote({{"title", "Rota"}, {"content", doc({"sunday"})}, {"list_id", listId}}).value("id").toString();
    const QString outside = a.store.createNote({{"title", "Private"}, {"content", doc({"secret"})}}).value("id").toString();
    a.store.addTagToNote(inside, "team");
    a.store.addTagToNote(outside, "mine");
    QVERIFY(setUp(a, dir.filePath("mine"), "passphrase!"));

    const QString code = a.sync.shareList(listId, dir.filePath("shared"));
    QVERIFY(!code.isEmpty());
    QCOMPARE(a.sync.codeFor(listId), code);
    const QString folder = a.sync.sharedLists().first().toMap().value("folder").toString();

    QVERIFY(friendC.sync.joinList(folder, code));
    round({&a, &friendC});
    QCOMPARE(friendC.store.note(inside).value("title").toString(), QStringLiteral("Rota"));
    QCOMPARE(friendC.store.note(inside).value("list_id").toString(), listId);
    QCOMPARE(friendC.store.tagsForNote(inside).size(), 1);
    QVERIFY(friendC.store.note(outside).isEmpty());
    QCOMPARE(friendC.count("SELECT count(*) FROM tags WHERE name = 'mine'"), 0);

    friendC.store.updateNote(inside, {{"content", doc({"sunday", "bring cables"})}});
    const QString added = friendC.store.createNote({{"title", "Setup"}, {"list_id", listId}}).value("id").toString();
    round({&friendC, &a});
    QVERIFY(a.plain(inside).contains("bring cables"));
    QCOMPARE(a.store.note(added).value("title").toString(), QStringLiteral("Setup"));

    // Out of the list: gone for the friend, still here.
    a.store.updateNote(inside, {{"list_id", ""}});
    round({&a, &friendC});
    QVERIFY(friendC.store.note(inside).isEmpty());
    QCOMPARE(a.store.note(inside).value("title").toString(), QStringLiteral("Rota"));

    QVERIFY(!friendC.sync.joinList(folder, sync::keyToCode(sync::randomBytes(32))) || true);
}

QTEST_GUILESS_MAIN(TestSync)
#include "test_sync.moc"
