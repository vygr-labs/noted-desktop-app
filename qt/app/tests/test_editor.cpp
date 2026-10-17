// Drives a real QML TextEdit + EditorController with simulated typing and
// checks the TipTap JSON that would be saved.

#include <QClipboard>
#include <QGuiApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QMimeData>
#include <QQmlComponent>
#include <QQmlEngine>
#include <QQuickItem>
#include <QQuickTextDocument>
#include <QQuickView>
#include <QTextBlock>
#include <QTextDocument>
#include <QTextList>
#include <QtTest>

#include "EditorController.h"
#include "OpenFiles.h"
#include "noted/Database.h"
#include "noted/NoteStore.h"
#include "noted/doc/TipTap.h"

using namespace noted;

class TestEditor : public QObject
{
    Q_OBJECT

private slots:
    void init();
    void cleanup();
    void markdownShortcutsAndLists();
    void enterOnEmptyItemLeavesList();
    void tabIndentsListItems();
    void codeFenceCreatesCodeBlock();
    void pendingBoldAppliesToTypedText();
    void pasteMarkdown();
    void pasteTypedOutStructure();
    void cleanAndFormatConvertsTypedMarkup();
    void cleanAndFormatPlacesCheckboxes();
    void openFileSavesInPlace();
    void undoRestoresText();
    void headingEnterMakesParagraph();
    void taskCheckboxToggle();

private:
    void type(const QString& text);
    void enter(bool shift = false);
    QJsonArray blocks();
    QString dump();

    QQuickView* m_view = nullptr;
    QQuickItem* m_edit = nullptr;
    EditorController* m_ctl = nullptr;
};

void TestEditor::init()
{
    m_view = new QQuickView;
    m_view->setResizeMode(QQuickView::SizeRootObjectToView);
    m_view->resize(700, 500);
    QQmlComponent c(m_view->engine());
    c.setData("import QtQuick\nTextEdit { width: 680; height: 480; textFormat: TextEdit.RichText; wrapMode: TextEdit.Wrap; focus: true }",
              QUrl());
    m_edit = qobject_cast<QQuickItem*>(c.create());
    QVERIFY2(m_edit, qPrintable(c.errorString()));
    m_view->setContent(QUrl(), &c, m_edit);
    m_view->show();
    QVERIFY(QTest::qWaitForWindowExposed(m_view));
    m_view->requestActivate();
    m_edit->forceActiveFocus();

    m_ctl = new EditorController;
    m_ctl->setTextDocument(m_edit->property("textDocument").value<QQuickTextDocument*>());
    auto sync = [this] {
        m_ctl->setSelectionStart(m_edit->property("selectionStart").toInt());
        m_ctl->setSelectionEnd(m_edit->property("selectionEnd").toInt());
        m_ctl->setCursorPosition(m_edit->property("cursorPosition").toInt());
    };
    // Stand-in for the QML property bindings (cursorPosition: edit.cursorPosition …).
    QTimer* poll = new QTimer(m_ctl);
    QObject::connect(poll, &QTimer::timeout, m_ctl, sync);
    poll->start(1);
    QObject::connect(m_ctl, &EditorController::requestCursor, m_edit, [this](int pos, int anchor) {
        if (pos == anchor) m_edit->setProperty("cursorPosition", pos);
        else QMetaObject::invokeMethod(m_edit, "select", Q_ARG(int, anchor), Q_ARG(int, pos));
    });
    m_ctl->load(QStringLiteral("test-note"), QString());
    QTest::qWait(5);
}

void TestEditor::cleanup()
{
    delete m_ctl;
    delete m_view;
    m_ctl = nullptr;
    m_view = nullptr;
}

void TestEditor::type(const QString& text)
{
    for (QChar ch : text) {
        QTest::keyClick(m_view, ch.toLatin1());
        QTest::qWait(2);  // let the controller's queued input rules/restyle run
    }
    QTest::qWait(5);
}

void TestEditor::enter(bool shift)
{
    QTest::qWait(3);
    QVERIFY(m_ctl->handleEnter(shift));
    QTest::qWait(5);
}

QJsonArray TestEditor::blocks()
{
    return doc::parse(m_ctl->json()).value("content").toArray();
}

QString TestEditor::dump()
{
    return QString::fromUtf8(QJsonDocument(doc::parse(m_ctl->json())).toJson(QJsonDocument::Compact));
}

void TestEditor::markdownShortcutsAndLists()
{
    type("# Title");
    enter();
    type("- one");
    enter();
    type("two");
    const QJsonArray b = blocks();
    QCOMPARE(b.size(), 2);
    QCOMPARE(b[0].toObject()["type"].toString(), QStringLiteral("heading"));
    QCOMPARE(b[0].toObject()["attrs"].toObject()["level"].toInt(), 1);
    QCOMPARE(b[1].toObject()["type"].toString(), QStringLiteral("bulletList"));
    QCOMPARE(b[1].toObject()["content"].toArray().size(), 2);
}

void TestEditor::enterOnEmptyItemLeavesList()
{
    type("1. first");
    enter();
    enter();  // empty item → leaves the list
    type("after");
    const QJsonArray b = blocks();
    QCOMPARE(b.size(), 2);
    QCOMPARE(b[0].toObject()["type"].toString(), QStringLiteral("orderedList"));
    QCOMPARE(b[0].toObject()["content"].toArray().size(), 1);
    QCOMPARE(b[1].toObject()["type"].toString(), QStringLiteral("paragraph"));
}

void TestEditor::tabIndentsListItems()
{
    type("- parent");
    enter();
    type("child");
    QVERIFY(m_ctl->handleTab(false));
    QTest::qWait(5);
    const QJsonArray items = blocks()[0].toObject()["content"].toArray();
    QCOMPARE(items.size(), 1);
    const QJsonArray kids = items[0].toObject()["content"].toArray();
    QCOMPARE(kids.size(), 2);  // paragraph + nested list
    QCOMPARE(kids[1].toObject()["type"].toString(), QStringLiteral("bulletList"));
}

void TestEditor::codeFenceCreatesCodeBlock()
{
    type("```");
    enter();
    type("let x = 1");
    enter();
    type("x++");
    enter();
    enter();  // empty trailing line leaves the block
    type("prose");
    const QJsonArray b = blocks();
    int code = -1, prose = -1;
    for (int i = 0; i < b.size(); ++i) {
        if (b[i].toObject()["type"].toString() == u"codeBlock") code = i;
        if (b[i].toObject()["type"].toString() == u"paragraph") prose = i;
    }
    QVERIFY2(code >= 0, qPrintable(dump()));
    QCOMPARE(b[code].toObject()["content"].toArray()[0].toObject()["text"].toString(), QStringLiteral("let x = 1\nx++"));
    QVERIFY2(prose > code, qPrintable(dump()));
}

void TestEditor::pendingBoldAppliesToTypedText()
{
    type("plain ");
    m_ctl->toggleBold();
    type("bold");
    const QJsonArray inl = blocks()[0].toObject()["content"].toArray();
    QVERIFY2(inl.size() == 2, qPrintable(dump()));
    QCOMPARE(inl[1].toObject()["marks"].toArray()[0].toObject()["type"].toString(), QStringLiteral("bold"));
    QCOMPARE(inl[1].toObject()["text"].toString(), QStringLiteral("bold"));
}

void TestEditor::pasteMarkdown()
{
    auto* mime = new QMimeData;
    mime->setText(QStringLiteral("## Pasted\n\n- a\n- b\n\n**strong** text"));
    QGuiApplication::clipboard()->setMimeData(mime);
    m_ctl->paste(false);
    QTest::qWait(10);
    const QJsonArray b = blocks();
    QVERIFY2(b.size() >= 3, qPrintable(dump()));
    QCOMPARE(b[0].toObject()["type"].toString(), QStringLiteral("heading"));
    QCOMPARE(b[1].toObject()["type"].toString(), QStringLiteral("bulletList"));
    const QJsonArray last = b[2].toObject()["content"].toArray();
    QCOMPARE(last[0].toObject()["marks"].toArray()[0].toObject()["type"].toString(), QStringLiteral("bold"));
}

// Plain text that only spells out structure ("[ ] task", "=== Heading ===")
// pastes as real checkboxes and headings.
void TestEditor::pasteTypedOutStructure()
{
    auto* mime = new QMimeData;
    mime->setText(QStringLiteral("=== WEEK 1 ===\n[ ] Tue post\nIMAGE: ready\n[x] Wed post"));
    QGuiApplication::clipboard()->setMimeData(mime);
    m_ctl->paste(false);
    QTest::qWait(10);
    const QJsonArray b = blocks();
    QVERIFY2(b.size() == 4, qPrintable(dump()));
    QCOMPARE(b[0].toObject()["type"].toString(), QStringLiteral("heading"));
    QCOMPARE(b[0].toObject()["content"].toArray()[0].toObject()["text"].toString(), QStringLiteral("WEEK 1"));
    QCOMPARE(b[1].toObject()["type"].toString(), QStringLiteral("taskList"));
    QCOMPARE(b[2].toObject()["type"].toString(), QStringLiteral("paragraph"));
    const QJsonObject done = b[3].toObject()["content"].toArray()[0].toObject();
    QCOMPARE(done["attrs"].toObject()["checked"].toBool(), true);
}

void TestEditor::cleanAndFormatConvertsTypedMarkup()
{
    m_ctl->load(QStringLiteral("test-note"),
                doc::stringify(doc::fromPlainText(QStringLiteral("## Plan\n[ ] first\n- [x] second\n\n\n--- Later ---\n1. one"))));
    QTest::qWait(5);
    m_ctl->cleanAndFormat();
    QTest::qWait(5);
    const QJsonArray b = blocks();
    QVERIFY2(b.size() == 5, qPrintable(dump()));
    QCOMPARE(b[0].toObject()["type"].toString(), QStringLiteral("heading"));
    QCOMPARE(b[1].toObject()["type"].toString(), QStringLiteral("taskList"));
    QCOMPARE(b[1].toObject()["content"].toArray().size(), 2);
    QCOMPARE(b[2].toObject()["type"].toString(), QStringLiteral("paragraph"));  // two blank lines → one
    QCOMPARE(b[3].toObject()["content"].toArray()[0].toObject()["text"].toString(), QStringLiteral("Later"));
    QCOMPARE(b[4].toObject()["type"].toString(), QStringLiteral("orderedList"));
}

// Converting a note in place (blank lines removed above the new checklist
// items) must leave the checkboxes on the right lines and no bullet glyphs.
void TestEditor::cleanAndFormatPlacesCheckboxes()
{
    m_ctl->load(QStringLiteral("test-note"),
                doc::stringify(doc::fromPlainText(QStringLiteral("Intro\n\n\nMore\n\n\n[ ] one\nIMAGE: ready\n\n\n[ ] two\nEnd"))));
    QTest::qWait(5);
    m_ctl->cleanAndFormat();
    QTest::qWait(300);  // let the restyle and decoration timers run
    QTextDocument* d = m_edit->property("textDocument").value<QQuickTextDocument*>()->textDocument();
    QStringList taskTexts;
    for (const QVariant& v : m_ctl->decorations()) {
        const QVariantMap m = v.toMap();
        if (m.value("k").toString() != u"task") continue;
        const QTextBlock blk = d->findBlockByNumber(m.value("block").toInt());
        taskTexts << blk.text();
        QVERIFY(blk.textList());
        QCOMPARE(blk.textList()->format().style(), QTextListFormat::ListStyleUndefined);
    }
    QCOMPARE(taskTexts, (QStringList{QStringLiteral("one"), QStringLiteral("two")}));

    // Rewrapping (the window or column changing width) must not bring list markers back.
    m_edit->setWidth(300);
    QTest::qWait(300);
    for (QTextBlock blk = d->begin(); blk.isValid(); blk = blk.next())
        if (blk.textList())
            QVERIFY2(blk.textList()->format().style() == QTextListFormat::ListStyleUndefined, qPrintable(blk.text()));
}

// A markdown file opened from disk saves back to the same file, keeping its
// CRLF line endings, and nothing goes to the database.
void TestEditor::openFileSavesInPlace()
{
    QTemporaryDir dir;
    Database db(dir.filePath("app.sqlite"));
    NoteStore store(db);
    OpenFiles files(store);
    const QString path = dir.filePath("plan.md");
    {
        QFile f(path);
        QVERIFY(f.open(QIODevice::WriteOnly));
        f.write("# Plan\r\n\r\n- one\r\n");
    }
    const QString id = files.open(path);
    QVERIFY(OpenFiles::isFile(id));
    QCOMPARE(files.files().size(), 1);
    const QVariantMap note = files.note(id);
    QCOMPARE(note.value("note_type").toString(), QStringLiteral("rich"));

    m_ctl->setFiles(&files);
    // Use the file's own content, with a task list like real notes have.
    {
        QFile f(path);
        QVERIFY(f.open(QIODevice::WriteOnly));
        f.write("# Plan\r\n\r\n- [ ] task\r\n\r\n- one\r\n");
    }
    m_ctl->load(id, files.note(id).value("content").toString());
    QTest::qWait(50);
    QVERIFY2(!m_ctl->dirty(), "opening a file must not mark it changed");
    // Saving it untouched leaves the file's own formatting alone ("- [ ]" spacing, blank lines).
    QVERIFY(files.writeDoc(id, doc::parse(m_ctl->json())));
    {
        QFile f(path);
        QVERIFY(f.open(QIODevice::ReadOnly));
        QCOMPARE(f.readAll(), QByteArray("# Plan\r\n\r\n- [ ] task\r\n\r\n- one\r\n"));
    }
    QTest::keyClick(m_view, Qt::Key_End, Qt::ControlModifier);
    QTest::qWait(5);
    type(" two");
    QVERIFY(m_ctl->flush());

    QFile f(path);
    QVERIFY(f.open(QIODevice::ReadOnly));
    const QString saved = QString::fromUtf8(f.readAll());
    QVERIFY2(saved.contains(QStringLiteral("one two")), qPrintable(saved));
    QVERIFY2(saved.contains(QStringLiteral("\r\n")) && !saved.contains(QRegularExpression(QStringLiteral("[^\r]\n"))), qPrintable(saved));
    QCOMPARE(store.counts().value("all").toInt(), 0);

    // Our own save isn't reported as an outside change; another program's is.
    QSignalSpy changed(&files, &OpenFiles::externallyChanged);
    QTest::qWait(200);
    QCOMPARE(changed.count(), 0);
    {
        QFile out(path);
        QVERIFY(out.open(QIODevice::WriteOnly));
        out.write("# Plan\r\n\r\nedited elsewhere\r\n");
    }
    QTRY_COMPARE(changed.count(), 1);
    QCOMPARE(changed.first().first().toString(), id);
    QVERIFY(files.note(id).value("content_plain").toString().contains(QStringLiteral("edited elsewhere")));
}

void TestEditor::undoRestoresText()
{
    type("hello");
    QTest::keyClick(m_view, Qt::Key_Z, Qt::ControlModifier);
    QTest::qWait(10);
    const QString text = m_ctl->plainText();
    QVERIFY2(text.size() < 5, qPrintable(text));
}

void TestEditor::headingEnterMakesParagraph()
{
    type("## Section");
    enter();
    type("body");
    const QJsonArray b = blocks();
    QCOMPARE(b[0].toObject()["type"].toString(), QStringLiteral("heading"));
    QCOMPARE(b[1].toObject()["type"].toString(), QStringLiteral("paragraph"));
}

void TestEditor::taskCheckboxToggle()
{
    type("[ ] buy milk");
    QCOMPARE(blocks()[0].toObject()["type"].toString(), QStringLiteral("taskList"));
    // Click in the gutter left of the text.
    QVERIFY(m_ctl->clickAt(2, 0, 20));
    QTest::qWait(5);
    const QJsonObject item = blocks()[0].toObject()["content"].toArray()[0].toObject();
    QCOMPARE(item["attrs"].toObject()["checked"].toBool(), true);
}

QTEST_MAIN(TestEditor)
#include "test_editor.moc"
