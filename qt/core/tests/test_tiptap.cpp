#include <QJsonArray>
#include <QJsonDocument>
#include <QTextBlock>
#include <QTextCursor>
#include <QTextDocument>
#include <QTextList>
#include <QtTest>

#include "noted/PinHasher.h"
#include "noted/doc/Export.h"
#include "noted/doc/Schema.h"
#include "noted/doc/Styler.h"
#include "noted/doc/TipTap.h"

using namespace noted;

class TestTipTap : public QObject
{
    Q_OBJECT

private slots:
    void paragraphsAndMarks();
    void nestedLists();
    void quotesCodeTables();
    void plainTextMatchesElectron();
    void markdownImport();
    void enterInListCreatesNewItem();
    void scryptMatchesNode();
    void imagesRoundTrip();
};

namespace {

QJsonObject j(const char* s)
{
    return QJsonDocument::fromJson(QByteArray(s)).object();
}

QJsonObject roundTrip(const QJsonObject& in)
{
    QTextDocument d;
    doc::load(&d, in);
    doc::Styler().apply(&d);
    return doc::save(&d);
}

}  // namespace

void TestTipTap::paragraphsAndMarks()
{
    const QJsonObject in = j(R"({"type":"doc","content":[
        {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Title"}]},
        {"type":"paragraph","content":[
            {"type":"text","text":"plain "},
            {"type":"text","marks":[{"type":"bold"}],"text":"bold"},
            {"type":"text","text":" and "},
            {"type":"text","marks":[{"type":"link","attrs":{"href":"https://x.y","target":"_blank","rel":"noopener noreferrer nofollow","class":null,"title":null}},{"type":"underline"}],"text":"link"},
            {"type":"hardBreak"},
            {"type":"text","marks":[{"type":"code"}],"text":"code"}]},
        {"type":"paragraph"},
        {"type":"horizontalRule"}]})");
    QCOMPARE(roundTrip(in), in);
}

void TestTipTap::nestedLists()
{
    const QJsonObject in = j(R"({"type":"doc","content":[
        {"type":"bulletList","content":[
            {"type":"listItem","content":[
                {"type":"paragraph","content":[{"type":"text","text":"one"}]},
                {"type":"orderedList","attrs":{"start":3,"type":null},"content":[
                    {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"a"}]}]},
                    {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"b"}]},
                                                  {"type":"paragraph","content":[{"type":"text","text":"b2"}]}]}]}]},
            {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"two"}]}]}]},
        {"type":"taskList","content":[
            {"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"done"}]}]},
            {"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph"}]}]}]})");
    QCOMPARE(roundTrip(in), in);
}

void TestTipTap::quotesCodeTables()
{
    const QJsonObject in = j(R"({"type":"doc","content":[
        {"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"quoted"}]},
                                        {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"in quote"}]}]}]}]},
        {"type":"codeBlock","attrs":{"language":null},"content":[{"type":"text","text":"line 1\n\nline 3"}]},
        {"type":"table","content":[
            {"type":"tableRow","content":[
                {"type":"tableHeader","attrs":{"colspan":1,"rowspan":1,"colwidth":null},"content":[{"type":"paragraph","content":[{"type":"text","text":"H"}]}]},
                {"type":"tableHeader","attrs":{"colspan":1,"rowspan":1,"colwidth":null},"content":[{"type":"paragraph"}]}]},
            {"type":"tableRow","content":[
                {"type":"tableCell","attrs":{"colspan":1,"rowspan":1,"colwidth":null},"content":[{"type":"paragraph","content":[{"type":"inlineCheckbox","attrs":{"checked":true}},{"type":"text","text":" x"}]}]},
                {"type":"tableCell","attrs":{"colspan":1,"rowspan":1,"colwidth":null},"content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"highlight"}],"text":"hi"}]}]}]}]},
        {"type":"paragraph","content":[{"type":"text","text":"after"}]}]})");
    QCOMPARE(roundTrip(in), in);
}

void TestTipTap::plainTextMatchesElectron()
{
    const QJsonObject in = j(R"({"type":"doc","content":[
        {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"T"}]},
        {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"a"}]}]}]},
        {"type":"table","content":[{"type":"tableRow","content":[
            {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"x"}]}]},
            {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"y"}]}]}]}]}]})");
    // heading\n + (paragraph\n + listItem\n) + (x\ty\n + table\n) → trimmed
    QCOMPARE(doc::toPlainText(in), QStringLiteral("T\na\n\nx\ty"));  // verified against the TS implementation
}

void TestTipTap::markdownImport()
{
    const QJsonObject d = doc::fromMarkdown(QStringLiteral(
        "# Title\n\nSome **bold** and `code`.\n\n- [ ] todo\n- [x] done\n\n1. one\n2. two\n\n> quote\n\n```\nx = 1\n```\n"));
    const QString md = doc::toMarkdown(d);
    QVERIFY2(md.contains(QStringLiteral("# Title")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("**bold**")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("`code`")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("- [ ] todo")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("- [x] done")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("1. one")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("> quote")), qPrintable(md));
    QVERIFY2(md.contains(QStringLiteral("```\nx = 1\n```")), qPrintable(md));
}

void TestTipTap::enterInListCreatesNewItem()
{
    QTextDocument d;
    doc::load(&d, j(R"({"type":"doc","content":[{"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"a"}]}]}]}]})"));
    QTextCursor c(&d);
    c.movePosition(QTextCursor::End);
    c.insertBlock();
    c.insertText(QStringLiteral("b"));
    const QJsonObject out = doc::save(&d);
    const QJsonArray items = out["content"].toArray()[0].toObject()["content"].toArray();
    QCOMPARE(items.size(), 2);
}

void TestTipTap::scryptMatchesNode()
{
    // node -e "require('crypto').scryptSync('1234','abcdef0123456789abcdef0123456789',64).toString('hex')"
    QCOMPARE(hashPin(QStringLiteral("1234"), QStringLiteral("abcdef0123456789abcdef0123456789")),
             QStringLiteral("35d5eec2fe550b9f712969686d680af2c3a1c7171b451b037f62b48e181c582f"
                            "4c64ed4f2ccc65812c72bae6152efc3b2082ced12f67bf7d0fdaa5e5c32f16fd"));
}


void TestTipTap::imagesRoundTrip()
{
    // Between paragraphs, after a heading, and with alt text kept; text typed
    // next to an image comes back as a paragraph after it.
    const QJsonObject in = j(R"({"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"before"}]},
        {"type":"image","attrs":{"src":"attachment:abc.png","alt":"a cat","title":null}},
        {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Then"}]},
        {"type":"image","attrs":{"src":"https://example.com/x.jpg"}},
        {"type":"paragraph","content":[{"type":"text","text":"after"}]}]})");
    QCOMPARE(roundTrip(in), in);
    QVERIFY(doc::toMarkdown(in).contains(QStringLiteral("![a cat](")));
    QCOMPARE(doc::toPlainText(in).contains(QStringLiteral("attachment")), false);
}

QTEST_MAIN(TestTipTap)
#include "test_tiptap.moc"
