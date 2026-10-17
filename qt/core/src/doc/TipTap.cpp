#include "noted/doc/TipTap.h"

#include <QFont>
#include <QJsonArray>
#include <QJsonDocument>
#include <QRegularExpression>
#include <QTextBlock>
#include <QTextCursor>
#include <QTextDocument>
#include <QTextDocumentFragment>
#include <QTextFrame>
#include <QTextList>
#include <QTextTable>

#include <memory>
#include <vector>

#include "noted/doc/Schema.h"

namespace noted::doc {

namespace {

const QString kType = QStringLiteral("type");
const QString kAttrs = QStringLiteral("attrs");
const QString kContent = QStringLiteral("content");
const QString kText = QStringLiteral("text");
const QString kMarks = QStringLiteral("marks");

QString compact(const QJsonObject& o)
{
    return QString::fromUtf8(QJsonDocument(o).toJson(QJsonDocument::Compact));
}

QJsonObject objectFrom(const QVariant& v)
{
    const QString s = v.toString();
    if (s.isEmpty()) return {};
    return QJsonDocument::fromJson(s.toUtf8()).object();
}

bool isListType(const QString& t)
{
    return t == u"bulletList" || t == u"orderedList" || t == u"taskList";
}

QTextListFormat::Style bulletStyleForDepth(int depth)
{
    switch ((depth - 1) % 3) {
    case 0:  return QTextListFormat::ListDisc;
    case 1:  return QTextListFormat::ListCircle;
    default: return QTextListFormat::ListSquare;
    }
}

// ════════════════════════════════════════════════════════════════════════
//  Import: JSON → QTextDocument
// ════════════════════════════════════════════════════════════════════════

class Importer
{
public:
    explicit Importer(const QTextCursor& at, bool fresh)
        : m_cur(at)
        , m_fresh(fresh)
    {}

    void blocks(const QJsonArray& arr)
    {
        for (const QJsonValue& v : arr) block(v.toObject());
    }

    QTextCursor cursor() const { return m_cur; }

    void inlinesAt(const QJsonArray& content) { inlines(content); }

private:
    struct ListCtx {
        int kind = BulletList;
        int depth = 1;
        QJsonObject attrs;
        QTextList* list = nullptr;
    };

    void block(const QJsonObject& n)
    {
        const QString type = n.value(kType).toString();
        if (type == u"paragraph" || type == u"heading" || type == u"horizontalRule") {
            leaf(n);
        } else if (type == u"codeBlock") {
            codeBlock(n);
        } else if (isListType(type)) {
            list(n);
        } else if (type == u"blockquote") {
            ++m_quote;
            blocks(n.value(kContent).toArray());
            --m_quote;
        } else if (type == u"table") {
            table(n);
        } else if (type == u"detailsBlock") {
            // Hidden sections flatten to a summary line + their content.
            QJsonObject summary{{kType, QStringLiteral("paragraph")}};
            const QString s = n.value(kAttrs).toObject().value(QStringLiteral("summary")).toString();
            if (!s.isEmpty())
                summary.insert(kContent, QJsonArray{QJsonObject{
                                             {kType, QStringLiteral("text")},
                                             {kText, s},
                                             {kMarks, QJsonArray{QJsonObject{{kType, QStringLiteral("bold")}}}}}});
            leaf(summary);
            blocks(n.value(kContent).toArray());
        } else if (n.contains(kContent)) {
            // Unknown container: keep its children.
            const QJsonArray kids = n.value(kContent).toArray();
            bool inlineKids = !kids.isEmpty() && kids.first().toObject().value(kType).toString() == u"text";
            if (inlineKids) {
                leaf(QJsonObject{{kType, QStringLiteral("paragraph")}, {kContent, kids}});
            } else {
                blocks(kids);
            }
        }
    }

    // Starts a new block (or reuses the untouched one under the cursor).
    void startBlock(const QTextBlockFormat& bf)
    {
        if (m_fresh) {
            m_cur.setBlockFormat(bf);
            m_cur.setBlockCharFormat(QTextCharFormat());
            m_fresh = false;
        } else {
            m_cur.insertBlock(bf, QTextCharFormat());
        }
    }

    // Applies list/quote context to a leaf's block format and places it.
    void placeLeaf(QTextBlockFormat bf)
    {
        if (m_quote > 0) bf.setProperty(QTextFormat::BlockQuoteLevel, m_quote);
        if (m_lists.isEmpty()) {
            startBlock(bf);
            return;
        }
        ListCtx& L = m_lists.last();
        if (m_itemPending) {
            m_itemPending = false;
            if (!m_itemAttrs.isEmpty()) bf.setProperty(BlockItemAttrs, compact(m_itemAttrs));
            if (L.kind == TaskList) {
                const bool checked = m_itemAttrs.value(QStringLiteral("checked")).toBool();
                setTaskChecked(bf, checked);
            }
            startBlock(bf);
            if (!L.list) {
                QTextListFormat lf;
                lf.setIndent(L.depth);
                lf.setProperty(ListKind, L.kind);
                if (!L.attrs.isEmpty()) lf.setProperty(ListNodeAttrs, compact(L.attrs));
                if (L.kind == OrderedList) {
                    lf.setStyle(QTextListFormat::ListDecimal);
                    lf.setStart(qMax(1, L.attrs.value(QStringLiteral("start")).toInt(1)));
                } else if (L.kind == TaskList) {
                    lf.setStyle(QTextListFormat::ListStyleUndefined);  // the editor draws the checkbox
                } else {
                    lf.setStyle(bulletStyleForDepth(L.depth));
                }
                L.list = m_cur.createList(lf);
            } else {
                L.list->add(m_cur.block());
            }
        } else {
            bf.setProperty(BlockListContinuation, L.depth);
            startBlock(bf);
        }
    }

    static QTextCharFormat marksFormat(const QJsonArray& marks)
    {
        QTextCharFormat cf;
        cf.setProperty(MarkBold, false);
        cf.setProperty(MarkItalic, false);
        cf.setProperty(MarkUnderline, false);
        cf.setProperty(MarkStrike, false);
        cf.setProperty(MarkCode, false);
        cf.setProperty(MarkHighlight, false);
        for (const QJsonValue& mv : marks) {
            const QJsonObject m = mv.toObject();
            const QString t = m.value(kType).toString();
            if (t == u"bold") cf.setProperty(MarkBold, true);
            else if (t == u"italic") cf.setProperty(MarkItalic, true);
            else if (t == u"underline") cf.setProperty(MarkUnderline, true);
            else if (t == u"strike") cf.setProperty(MarkStrike, true);
            else if (t == u"code") cf.setProperty(MarkCode, true);
            else if (t == u"highlight") {
                cf.setProperty(MarkHighlight, true);
                if (m.contains(kAttrs)) cf.setProperty(MarkHighlightAttrs, compact(m.value(kAttrs).toObject()));
            } else if (t == u"link") {
                const QJsonObject a = m.value(kAttrs).toObject();
                cf.setAnchor(true);
                cf.setAnchorHref(a.value(QStringLiteral("href")).toString());
                cf.setProperty(MarkLinkAttrs, compact(a));
            }
        }
        return cf;
    }

    void inlines(const QJsonArray& content)
    {
        for (const QJsonValue& v : content) {
            const QJsonObject n = v.toObject();
            const QString type = n.value(kType).toString();
            const QTextCharFormat cf = marksFormat(n.value(kMarks).toArray());
            if (type == u"text") {
                QString t = n.value(kText).toString();
                t.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
                t.replace(QLatin1Char('\r'), QLatin1Char('\n'));
                t.replace(QLatin1Char('\n'), QChar::LineSeparator);
                m_cur.insertText(t, cf);
            } else if (type == u"hardBreak") {
                m_cur.insertText(QString(QChar::LineSeparator), cf);
            } else if (type == u"inlineCheckbox") {
                const bool checked = n.value(kAttrs).toObject().value(QStringLiteral("checked")).toBool();
                QTextCharFormat box = cf;
                box.setProperty(InlineCheckbox, true);
                box.setProperty(InlineCheckboxChecked, checked);
                m_cur.insertText(QString(QChar(checked ? kCheckboxChecked : kCheckboxUnchecked)), box);
            } else if (n.contains(kText)) {
                m_cur.insertText(n.value(kText).toString(), cf);
            } else if (n.contains(kContent)) {
                inlines(n.value(kContent).toArray());
            }
        }
    }

    void leaf(const QJsonObject& n)
    {
        const QString type = n.value(kType).toString();
        const QJsonObject attrs = n.value(kAttrs).toObject();
        QTextBlockFormat bf;
        if (n.contains(kAttrs)) bf.setProperty(BlockNodeAttrs, compact(attrs));
        if (type == u"heading") {
            bf.setProperty(BlockKind, Heading);
            bf.setHeadingLevel(qBound(1, attrs.value(QStringLiteral("level")).toInt(1), 6));
        } else if (type == u"horizontalRule") {
            bf.setProperty(BlockKind, HorizontalRule);
            bf.setProperty(QTextFormat::BlockTrailingHorizontalRulerWidth,
                           QTextLength(QTextLength::PercentageLength, 100));
        } else {
            bf.setProperty(BlockKind, Paragraph);
        }
        placeLeaf(bf);
        if (type != u"horizontalRule") inlines(n.value(kContent).toArray());
    }

    // Leaves the cursor in a fresh scaffold block after `frame`.
    void exitFrame(QTextFrame* frame)
    {
        m_cur = frame->lastCursorPosition();
        m_cur.movePosition(QTextCursor::NextBlock);
        QTextBlockFormat scaffold;
        scaffold.setProperty(BlockScaffold, true);
        m_cur.setBlockFormat(scaffold);
        m_fresh = true;
    }

    void markFreshAsScaffold()
    {
        if (!m_fresh) return;
        QTextBlockFormat scaffold;
        scaffold.setProperty(BlockScaffold, true);
        m_cur.setBlockFormat(scaffold);
    }

    void codeBlock(const QJsonObject& n)
    {
        // Code blocks inside list items lose their list membership: frames
        // cannot be list items. The text survives; only nesting is flattened.
        markFreshAsScaffold();
        QTextFrameFormat ff;
        ff.setProperty(FrameKind, CodeBlockFrame);
        if (m_quote > 0) ff.setProperty(QTextFormat::BlockQuoteLevel, m_quote);
        if (n.contains(kAttrs)) ff.setProperty(FrameNodeAttrs, compact(n.value(kAttrs).toObject()));
        QTextFrame* frame = m_cur.insertFrame(ff);

        QString text;
        for (const QJsonValue& v : n.value(kContent).toArray()) text += v.toObject().value(kText).toString();
        // QTextDocument treats \r as a paragraph break; CRLF pasted from
        // Windows tools would double every line.
        text.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
        text.replace(QLatin1Char('\r'), QLatin1Char('\n'));
        const QStringList lines = text.split(QLatin1Char('\n'));
        QTextCharFormat plain = marksFormat({});
        QTextBlockFormat bf;
        bf.setProperty(BlockKind, Paragraph);
        for (int i = 0; i < lines.size(); ++i) {
            if (i == 0) {
                m_cur.setBlockFormat(bf);
                m_cur.setBlockCharFormat(plain);
            } else {
                m_cur.insertBlock(bf, plain);
            }
            if (!lines[i].isEmpty()) m_cur.insertText(lines[i], plain);
        }
        exitFrame(frame);
    }

    void list(const QJsonObject& n)
    {
        const QString type = n.value(kType).toString();
        ListCtx ctx;
        ctx.kind = type == u"orderedList" ? OrderedList : type == u"taskList" ? TaskList : BulletList;
        ctx.depth = int(m_lists.size()) + 1;
        if (n.contains(kAttrs)) ctx.attrs = n.value(kAttrs).toObject();
        m_lists.push_back(ctx);
        for (const QJsonValue& iv : n.value(kContent).toArray()) {
            const QJsonObject item = iv.toObject();
            m_itemPending = true;
            m_itemAttrs = item.value(kAttrs).toObject();
            if (!item.contains(kAttrs)) m_itemAttrs = {};
            const QJsonArray kids = item.value(kContent).toArray();
            if (kids.isEmpty()) leaf(QJsonObject{{kType, QStringLiteral("paragraph")}});
            else blocks(kids);
            if (m_itemPending) {
                // Item whose first child was not a leaf (e.g. a bare nested
                // list): give it an empty first line so it still exists.
                m_itemPending = false;
            }
        }
        m_lists.pop_back();
    }

    void table(const QJsonObject& n)
    {
        const QJsonArray rows = n.value(kContent).toArray();
        if (rows.isEmpty()) return;

        struct Placed {
            int row, col, rs, cs;
            QJsonObject node;
        };
        std::vector<Placed> placed;
        QSet<quint64> occupied;
        auto key = [](int r, int c) { return (quint64(quint32(r)) << 32) | quint32(c); };
        int cols = 0;
        for (int r = 0; r < rows.size(); ++r) {
            int c = 0;
            for (const QJsonValue& cv : rows[r].toObject().value(kContent).toArray()) {
                const QJsonObject cell = cv.toObject();
                while (occupied.contains(key(r, c))) ++c;
                const QJsonObject a = cell.value(kAttrs).toObject();
                const int cs = qMax(1, a.value(QStringLiteral("colspan")).toInt(1));
                const int rs = qMax(1, a.value(QStringLiteral("rowspan")).toInt(1));
                placed.push_back({r, c, rs, cs, cell});
                for (int dr = 0; dr < rs; ++dr)
                    for (int dc = 0; dc < cs; ++dc) occupied.insert(key(r + dr, c + dc));
                c += cs;
                cols = qMax(cols, c);
            }
        }
        if (cols == 0) return;

        markFreshAsScaffold();
        QTextTableFormat tf;
        tf.setBorderCollapse(true);
        tf.setWidth(QTextLength(QTextLength::PercentageLength, 100));
        if (n.contains(kAttrs)) tf.setProperty(TableNodeAttrs, compact(n.value(kAttrs).toObject()));
        QTextTable* t = m_cur.insertTable(int(rows.size()), cols, tf);

        for (const Placed& p : placed)
            if (p.rs > 1 || p.cs > 1) t->mergeCells(p.row, p.col, p.rs, p.cs);

        // Save context; a cell is its own little document.
        const int savedQuote = m_quote;
        const auto savedLists = m_lists;
        const bool savedPending = m_itemPending;
        m_quote = 0;
        m_lists.clear();
        m_itemPending = false;

        for (const Placed& p : placed) {
            QTextTableCell cell = t->cellAt(p.row, p.col);
            m_cur = cell.firstCursorPosition();
            m_fresh = true;
            blocks(p.node.value(kContent).toArray());
        }
        // A cell's format lives on the same character as its first block's
        // char format, which filling the cell resets — so tag cells last.
        for (const Placed& p : placed) {
            QTextTableCell cell = t->cellAt(p.row, p.col);
            QTextCharFormat cfmt = cell.format();
            cfmt.setProperty(CellIsHeader, p.node.value(kType).toString() == u"tableHeader");
            if (p.node.contains(kAttrs)) cfmt.setProperty(CellNodeAttrs, compact(p.node.value(kAttrs).toObject()));
            cell.setFormat(cfmt);
        }

        m_quote = savedQuote;
        m_lists = savedLists;
        m_itemPending = savedPending;
        exitFrame(t);
    }

    QTextCursor m_cur;
    bool m_fresh = true;
    int m_quote = 0;
    QList<ListCtx> m_lists;
    bool m_itemPending = false;
    QJsonObject m_itemAttrs;
};

// ════════════════════════════════════════════════════════════════════════
//  Export: QTextDocument → JSON
// ════════════════════════════════════════════════════════════════════════

struct Node {
    QJsonObject obj;  // type/attrs/(text for code) — content assembled at the end
    std::vector<std::unique_ptr<Node>> kids;
    QJsonArray inlines;
    bool isLeaf = false;

    Node* add(QJsonObject o)
    {
        kids.push_back(std::make_unique<Node>());
        kids.back()->obj = std::move(o);
        return kids.back().get();
    }

    QJsonObject toJson() const
    {
        QJsonObject o = obj;
        if (isLeaf) {
            if (!inlines.isEmpty()) o.insert(kContent, inlines);
        } else {
            QJsonArray arr;
            for (const auto& k : kids) arr.append(k->toJson());
            if (!arr.isEmpty() || o.value(kType).toString() != u"horizontalRule") o.insert(kContent, arr);
        }
        return o;
    }
};

bool looksMonospace(const QTextCharFormat& cf)
{
    if (cf.fontFixedPitch()) return true;
    for (const QString& f : cf.fontFamilies().toStringList()) {
        const QString l = f.toLower();
        if (l.contains(u"mono") || l.contains(u"courier") || l.contains(u"consolas") || l.contains(u"code"))
            return true;
    }
    return false;
}

bool nativeIsCodeBlock(const QTextBlock& b)
{
    const QTextBlockFormat bf = b.blockFormat();
    return bf.hasProperty(QTextFormat::BlockCodeFence) || bf.nonBreakableLines();
}

class Exporter
{
public:
    Exporter(int from = -1, int to = -1)
        : m_from(from)
        , m_to(to)
    {}

    QJsonObject run(const QTextDocument* doc)
    {
        Node root;
        root.obj = QJsonObject{{kType, QStringLiteral("doc")}};
        frame(doc->rootFrame(), &root);
        if (root.kids.empty()) {
            Node* p = root.add(QJsonObject{{kType, QStringLiteral("paragraph")}});
            p->isLeaf = true;
        }
        return root.toJson();
    }

private:
    enum class Kind { Root, Quote, List, Item };
    struct Entry {
        Kind kind;
        Node* node;
        int depth = 0;
        const QTextList* list = nullptr;
    };

    bool inRange(int start, int end) const
    {
        if (m_from < 0) return true;
        return end > m_from && start < m_to;
    }

    // Walks one frame's children with its own container stack.
    void frame(const QTextFrame* f, Node* container)
    {
        std::vector<Entry> stack{{Kind::Root, container}};
        QList<QTextBlock> nativeCode;  // run of Qt-native code-fence blocks

        auto flushNativeCode = [&] {
            if (nativeCode.isEmpty()) return;
            QStringList lines;
            QString lang;
            for (const QTextBlock& b : nativeCode) {
                lines << clipText(b);
                if (lang.isEmpty()) lang = b.blockFormat().stringProperty(QTextFormat::BlockCodeLanguage);
            }
            popTo(stack, Kind::Root);
            addCode(stack.back().node, lines.join(QLatin1Char('\n')),
                    QJsonObject{{QStringLiteral("language"), lang.isEmpty() ? QJsonValue(QJsonValue::Null)
                                                                            : QJsonValue(lang)}});
            nativeCode.clear();
        };

        for (auto it = f->begin(); !it.atEnd(); ++it) {
            if (QTextFrame* child = it.currentFrame()) {
                flushNativeCode();
                if (!inRange(child->firstPosition(), child->lastPosition() + 1)) continue;
                if (auto* table = qobject_cast<QTextTable*>(child)) {
                    popTo(stack, Kind::Root);
                    stack.back().node->kids.push_back(std::make_unique<Node>(exportTable(table)));
                } else if (child->frameFormat().intProperty(FrameKind) == CodeBlockFrame) {
                    exportCodeFrame(child, stack);
                } else {
                    frame(child, stack.back().node);
                }
                continue;
            }
            const QTextBlock b = it.currentBlock();
            if (!b.isValid()) continue;
            if (!inRange(b.position(), b.position() + b.length())) continue;
            if (!b.blockFormat().hasProperty(BlockKind) && nativeIsCodeBlock(b) && !b.textList()) {
                nativeCode << b;
                continue;
            }
            flushNativeCode();
            addBlock(b, stack);
        }
        flushNativeCode();
    }

    static void popTo(std::vector<Entry>& stack, Kind k)
    {
        while (stack.size() > 1 && stack.back().kind != k) stack.pop_back();
    }

    static int quoteCount(const std::vector<Entry>& stack)
    {
        int n = 0;
        for (const Entry& e : stack)
            if (e.kind == Kind::Quote) ++n;
        return n;
    }

    static void popLists(std::vector<Entry>& stack)
    {
        while (stack.size() > 1 && (stack.back().kind == Kind::List || stack.back().kind == Kind::Item))
            stack.pop_back();
    }

    static int listKindOf(const QTextList* l, const QTextBlock& b)
    {
        const QTextListFormat lf = l->format();
        if (lf.hasProperty(ListKind)) return lf.intProperty(ListKind);
        if (b.blockFormat().marker() != QTextBlockFormat::MarkerType::NoMarker || b.blockFormat().hasProperty(BlockTaskChecked))
            return TaskList;
        switch (lf.style()) {
        case QTextListFormat::ListDecimal:
        case QTextListFormat::ListLowerAlpha:
        case QTextListFormat::ListUpperAlpha:
        case QTextListFormat::ListLowerRoman:
        case QTextListFormat::ListUpperRoman:
            return OrderedList;
        default:
            return BulletList;
        }
    }

    void addBlock(const QTextBlock& b, std::vector<Entry>& stack)
    {
        const QTextBlockFormat bf = b.blockFormat();
        if (bf.boolProperty(BlockScaffold) && b.text().isEmpty()) return;

        // ── blockquotes (always outermost) ────────────────────────────
        const int q = bf.intProperty(QTextFormat::BlockQuoteLevel);
        int cq = quoteCount(stack);
        if (q != cq) {
            if (q < cq) {
                while (quoteCount(stack) > q) stack.pop_back();
            } else {
                popLists(stack);
            }
            popLists(stack);
            for (cq = quoteCount(stack); cq < q; ++cq) {
                Node* n = stack.back().node->add(QJsonObject{{kType, QStringLiteral("blockquote")}});
                stack.push_back({Kind::Quote, n});
            }
        }

        // ── lists ─────────────────────────────────────────────────────
        const QTextList* L = b.textList();
        if (L) {
            const int depth = qMax(1, L->format().indent());
            while (stack.size() > 1) {
                const Entry& t = stack.back();
                if ((t.kind == Kind::List || t.kind == Kind::Item) && t.depth > depth) stack.pop_back();
                else if (t.kind == Kind::Item && t.depth == depth) stack.pop_back();
                else if (t.kind == Kind::List && t.depth == depth && t.list != L) stack.pop_back();
                else break;
            }
            const Entry& top = stack.back();
            if (!(top.kind == Kind::List && top.depth == depth && top.list == L)) {
                const int kind = listKindOf(L, b);
                QJsonObject lo{{kType, kind == OrderedList ? QStringLiteral("orderedList")
                                       : kind == TaskList  ? QStringLiteral("taskList")
                                                           : QStringLiteral("bulletList")}};
                const bool hadAttrs = L->format().hasProperty(ListNodeAttrs);
                QJsonObject attrs = objectFrom(L->format().property(ListNodeAttrs));
                if (kind == OrderedList) {
                    const int start = qMax(1, L->format().start());
                    if (hadAttrs || start != 1) attrs.insert(QStringLiteral("start"), start);
                    if (hadAttrs && !attrs.contains(QStringLiteral("type"))) attrs.insert(QStringLiteral("type"), QJsonValue::Null);
                }
                if (!attrs.isEmpty()) lo.insert(kAttrs, attrs);
                Node* ln = stack.back().node->add(lo);
                stack.push_back({Kind::List, ln, depth, L});
            }
            const int kind = listKindOf(L, b);
            QJsonObject io{{kType, kind == TaskList ? QStringLiteral("taskItem") : QStringLiteral("listItem")}};
            QJsonObject ia = objectFrom(bf.property(BlockItemAttrs));
            if (kind == TaskList) ia.insert(QStringLiteral("checked"), taskChecked(bf));
            if (!ia.isEmpty()) io.insert(kAttrs, ia);
            Node* in = stack.back().node->add(io);
            stack.push_back({Kind::Item, in, depth});
        } else {
            const int d = bf.intProperty(BlockListContinuation);
            if (d <= 0) {
                popLists(stack);
            } else {
                while (stack.size() > 1) {
                    const Entry& t = stack.back();
                    if ((t.kind == Kind::List || t.kind == Kind::Item) && t.depth > d) stack.pop_back();
                    else if (t.kind == Kind::List && t.depth == d) stack.pop_back();
                    else break;
                }
            }
        }

        // ── the leaf itself ───────────────────────────────────────────
        Node* parent = stack.back().node;
        const int kind = bf.hasProperty(BlockKind) ? bf.intProperty(BlockKind)
                         : bf.headingLevel() > 0   ? Heading
                         : bf.hasProperty(QTextFormat::BlockTrailingHorizontalRulerWidth) ? HorizontalRule
                                                                                          : Paragraph;
        QJsonObject attrs = objectFrom(bf.property(BlockNodeAttrs));
        QJsonObject lo;
        if (kind == Heading && bf.headingLevel() > 0) {
            lo.insert(kType, QStringLiteral("heading"));
            attrs.insert(QStringLiteral("level"), bf.headingLevel());
        } else if (kind == HorizontalRule) {
            lo.insert(kType, QStringLiteral("horizontalRule"));
        } else {
            lo.insert(kType, QStringLiteral("paragraph"));
        }
        if (!attrs.isEmpty()) lo.insert(kAttrs, attrs);
        Node* leaf = parent->add(lo);
        leaf->isLeaf = true;
        if (kind != HorizontalRule) {
            leaf->inlines = inlines(b, kind == Heading);
        } else {
            leaf->isLeaf = false;  // horizontalRule has no content key at all
        }
    }

    void addCode(Node* parent, const QString& text, const QJsonObject& attrs)
    {
        QJsonObject o{{kType, QStringLiteral("codeBlock")}};
        if (!attrs.isEmpty()) o.insert(kAttrs, attrs);
        Node* n = parent->add(o);
        n->isLeaf = true;
        if (!text.isEmpty()) n->inlines.append(QJsonObject{{kType, QStringLiteral("text")}, {kText, text}});
    }

    void exportCodeFrame(const QTextFrame* f, std::vector<Entry>& stack)
    {
        QStringList lines;
        for (auto it = f->begin(); !it.atEnd(); ++it) {
            const QTextBlock b = it.currentBlock();
            if (!b.isValid()) continue;
            if (!inRange(b.position(), b.position() + b.length())) continue;
            lines << clipText(b);
        }
        // Nodes that arrived without attrs (markdown via noted-cli) stay that way.
        const bool hadAttrs = f->frameFormat().hasProperty(FrameNodeAttrs);
        QJsonObject attrs = objectFrom(f->frameFormat().property(FrameNodeAttrs));
        if (hadAttrs && !attrs.contains(QStringLiteral("language"))) attrs.insert(QStringLiteral("language"), QJsonValue::Null);
        // Lists are closed; blockquote nesting comes from the frame.
        popLists(stack);
        const int q = f->frameFormat().intProperty(QTextFormat::BlockQuoteLevel);
        while (quoteCount(stack) > q) stack.pop_back();
        for (int cq = quoteCount(stack); cq < q; ++cq) {
            Node* n = stack.back().node->add(QJsonObject{{kType, QStringLiteral("blockquote")}});
            stack.push_back({Kind::Quote, n});
        }
        addCode(stack.back().node, lines.join(QLatin1Char('\n')), attrs);
    }

    // Block text clipped to the export range, with U+2028 as newlines.
    QString clipText(const QTextBlock& b) const
    {
        QString t = b.text();
        int start = 0, end = int(t.size());
        if (m_from >= 0) {
            start = qBound(0, m_from - b.position(), int(t.size()));
            end = qBound(0, m_to - b.position(), int(t.size()));
        }
        t = t.mid(start, end - start);
        t.replace(QChar::LineSeparator, QLatin1Char('\n'));
        return t;
    }

    static QJsonArray marksOf(const QTextCharFormat& cf, bool inHeading)
    {
        bool bold, italic, underline, strike, code, highlight;
        if (cf.hasProperty(MarkBold)) {
            bold = cf.boolProperty(MarkBold);
            italic = cf.boolProperty(MarkItalic);
            underline = cf.boolProperty(MarkUnderline);
            strike = cf.boolProperty(MarkStrike);
            code = cf.boolProperty(MarkCode);
            highlight = cf.boolProperty(MarkHighlight);
        } else {
            // Foreign formatting (Qt's markdown/HTML importers): read visuals.
            code = looksMonospace(cf);
            bold = !inHeading && cf.fontWeight() >= QFont::DemiBold;
            italic = cf.fontItalic();
            underline = cf.fontUnderline() && !cf.isAnchor();
            strike = cf.fontStrikeOut();
            highlight = !code && cf.background().style() != Qt::NoBrush
                        && cf.background().color().alpha() > 0;
        }
        QJsonArray marks;
        if (cf.isAnchor() && !cf.anchorHref().isEmpty()) {
            QJsonObject a = objectFrom(cf.property(MarkLinkAttrs));
            if (a.isEmpty()) {
                a = QJsonObject{{QStringLiteral("target"), QStringLiteral("_blank")},
                                {QStringLiteral("rel"), QStringLiteral("noopener noreferrer nofollow")},
                                {QStringLiteral("class"), QJsonValue::Null},
                                {QStringLiteral("title"), QJsonValue::Null}};
            }
            a.insert(QStringLiteral("href"), cf.anchorHref());
            marks.append(QJsonObject{{kType, QStringLiteral("link")}, {kAttrs, a}});
        }
        auto add = [&marks](bool on, const char* t) {
            if (on) marks.append(QJsonObject{{kType, QString::fromLatin1(t)}});
        };
        add(bold, "bold");
        add(code, "code");
        add(italic, "italic");
        add(strike, "strike");
        add(underline, "underline");
        if (highlight) {
            QJsonObject h{{kType, QStringLiteral("highlight")}};
            const QJsonObject ha = objectFrom(cf.property(MarkHighlightAttrs));
            if (!ha.isEmpty()) h.insert(kAttrs, ha);
            marks.append(h);
        }
        return marks;
    }

    QJsonArray inlines(const QTextBlock& b, bool inHeading) const
    {
        QJsonArray out;
        QString pendingText;
        QJsonArray pendingMarks;
        auto flush = [&] {
            if (pendingText.isEmpty()) return;
            QJsonObject t{{kType, QStringLiteral("text")}, {kText, pendingText}};
            if (!pendingMarks.isEmpty()) t.insert(kMarks, pendingMarks);
            out.append(t);
            pendingText.clear();
        };

        for (auto it = b.begin(); !it.atEnd(); ++it) {
            const QTextFragment frag = it.fragment();
            if (!frag.isValid()) continue;
            int fs = frag.position(), fe = frag.position() + frag.length();
            if (m_from >= 0) {
                fs = qMax(fs, m_from);
                fe = qMin(fe, m_to);
                if (fs >= fe) continue;
            }
            const QString text = frag.text().mid(fs - frag.position(), fe - fs);
            const QTextCharFormat cf = frag.charFormat();

            if (cf.boolProperty(InlineCheckbox)) {
                flush();
                for (QChar ch : text) {
                    Q_UNUSED(ch)
                    out.append(QJsonObject{
                        {kType, QStringLiteral("inlineCheckbox")},
                        {kAttrs, QJsonObject{{QStringLiteral("checked"), cf.boolProperty(InlineCheckboxChecked)}}}});
                }
                continue;
            }

            const QJsonArray marks = marksOf(cf, inHeading);
            const QStringList parts = text.split(QChar::LineSeparator);
            for (int i = 0; i < parts.size(); ++i) {
                if (i > 0) {
                    flush();
                    out.append(QJsonObject{{kType, QStringLiteral("hardBreak")}});
                }
                QString part = parts[i];
                part.remove(QChar::ObjectReplacementCharacter);
                if (part.isEmpty()) continue;
                if (!pendingText.isEmpty() && marks != pendingMarks) flush();
                pendingMarks = marks;
                pendingText += part;
            }
        }
        flush();
        return out;
    }

    Node exportTable(const QTextTable* t)
    {
        Node table;
        table.obj = QJsonObject{{kType, QStringLiteral("table")}};
        const QJsonObject tattrs = objectFrom(t->format().property(TableNodeAttrs));
        if (!tattrs.isEmpty()) table.obj.insert(kAttrs, tattrs);
        const bool nativeHeader = !t->format().hasProperty(TableNodeAttrs) && firstRowLooksLikeHeader(t);

        for (int r = 0; r < t->rows(); ++r) {
            Node* row = table.add(QJsonObject{{kType, QStringLiteral("tableRow")}});
            for (int c = 0; c < t->columns(); ++c) {
                const QTextTableCell cell = t->cellAt(r, c);
                if (!cell.isValid() || cell.row() != r || cell.column() != c) continue;
                const QTextCharFormat cf = cell.format();
                const bool header = cf.hasProperty(CellIsHeader) ? cf.boolProperty(CellIsHeader)
                                                                 : (nativeHeader && r == 0);
                const bool hadAttrs = cf.hasProperty(CellNodeAttrs) || !cf.hasProperty(CellIsHeader);
                QJsonObject attrs = objectFrom(cf.property(CellNodeAttrs));
                if (hadAttrs && attrs.isEmpty()) attrs.insert(QStringLiteral("colwidth"), QJsonValue::Null);
                if (hadAttrs || cell.columnSpan() != 1) attrs.insert(QStringLiteral("colspan"), cell.columnSpan());
                if (hadAttrs || cell.rowSpan() != 1) attrs.insert(QStringLiteral("rowspan"), cell.rowSpan());
                QJsonObject co{{kType, header ? QStringLiteral("tableHeader") : QStringLiteral("tableCell")}};
                if (!attrs.isEmpty()) co.insert(kAttrs, attrs);
                Node* cn = row->add(co);
                cellContent(cell, cn);
                if (cn->kids.empty()) {
                    Node* p = cn->add(QJsonObject{{kType, QStringLiteral("paragraph")}});
                    p->isLeaf = true;
                }
            }
        }
        return table;
    }

    static bool firstRowLooksLikeHeader(const QTextTable* t)
    {
        for (int c = 0; c < t->columns(); ++c) {
            const QTextTableCell cell = t->cellAt(0, c);
            const QTextCharFormat cf = cell.firstCursorPosition().charFormat();
            if (cf.fontWeight() < QFont::DemiBold && !cell.firstCursorPosition().block().text().isEmpty())
                return false;
        }
        return true;
    }

    void cellContent(const QTextTableCell& cell, Node* into)
    {
        // Cells are iterated like frames but belong to the table frame; walk
        // their blocks with a dedicated stack. Range filtering is disabled
        // inside tables: a partially selected table exports whole.
        const int savedFrom = m_from, savedTo = m_to;
        m_from = m_to = -1;
        std::vector<Entry> stack{{Kind::Root, into}};
        for (auto it = cell.begin(); !it.atEnd(); ++it) {
            if (QTextFrame* child = it.currentFrame()) {
                if (auto* table = qobject_cast<QTextTable*>(child)) {
                    popTo(stack, Kind::Root);
                    stack.back().node->kids.push_back(std::make_unique<Node>(exportTable(table)));
                } else if (child->frameFormat().intProperty(FrameKind) == CodeBlockFrame) {
                    exportCodeFrame(child, stack);
                }
                continue;
            }
            const QTextBlock b = it.currentBlock();
            if (b.isValid()) addBlock(b, stack);
        }
        m_from = savedFrom;
        m_to = savedTo;
    }

    int m_from, m_to;
};

}  // namespace

// ════════════════════════════════════════════════════════════════════════
//  Public API
// ════════════════════════════════════════════════════════════════════════

QJsonObject emptyDoc()
{
    return QJsonObject{{kType, QStringLiteral("doc")},
                       {kContent, QJsonArray{QJsonObject{{kType, QStringLiteral("paragraph")}}}}};
}

QJsonObject parse(const QString& json)
{
    if (json.trimmed().isEmpty()) return emptyDoc();
    QJsonParseError err{};
    const QJsonDocument d = QJsonDocument::fromJson(json.toUtf8(), &err);
    if (err.error != QJsonParseError::NoError || !d.isObject()) return emptyDoc();
    QJsonObject o = d.object();
    if (o.value(kType).toString() != u"doc") return emptyDoc();
    return o;
}

QString stringify(const QJsonObject& json)
{
    return QString::fromUtf8(QJsonDocument(json).toJson(QJsonDocument::Compact));
}

void load(QTextDocument* doc, const QJsonObject& json)
{
    const bool undo = doc->isUndoRedoEnabled();
    doc->setUndoRedoEnabled(false);
    doc->clear();
    QTextCursor cur(doc);
    // One edit block: views (QQuickTextEdit) relayout once at the end instead
    // of after every insert — the difference between ~1 s and ~50 ms on a big note.
    cur.beginEditBlock();
    Importer imp(cur, true);
    imp.blocks(json.value(kContent).toArray());
    cur.endEditBlock();
    doc->setUndoRedoEnabled(undo);
    doc->setModified(false);
}

void insert(QTextCursor& cursor, const QJsonObject& json)
{
    const QJsonArray blocks = json.value(kContent).toArray();
    cursor.beginEditBlock();
    if (cursor.hasSelection()) cursor.removeSelectedText();

    // A single paragraph pastes inline, inheriting the current block.
    if (blocks.size() == 1 && blocks.first().toObject().value(kType).toString() == u"paragraph") {
        Importer imp(cursor, false);
        imp.inlinesAt(blocks.first().toObject().value(kContent).toArray());
        cursor = imp.cursor();
        cursor.endEditBlock();
        return;
    }

    const QTextBlock here = cursor.block();
    const bool reuse = here.text().isEmpty() && !here.textList() && !cursor.currentTable();
    Importer imp(cursor, reuse);
    imp.blocks(blocks);
    cursor = imp.cursor();
    cursor.endEditBlock();
}

QJsonObject save(const QTextDocument* doc)
{
    return Exporter().run(doc);
}

QJsonObject saveRange(const QTextDocument* doc, int from, int to)
{
    if (from > to) std::swap(from, to);
    return Exporter(from, to).run(doc);
}

void semanticize(QTextDocument* doc)
{
    load(doc, save(doc));
}

QJsonObject fromMarkdown(const QString& markdown)
{
    QTextDocument d;
    d.setMarkdown(markdown, QTextDocument::MarkdownDialectGitHub);
    return save(&d);
}

QJsonObject fromHtml(const QString& html)
{
    QTextDocument d;
    d.setHtml(html);
    return save(&d);
}

QJsonObject fromPlainText(const QString& text)
{
    QJsonArray blocks;
    QString normalized = text;
    normalized.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));
    for (const QString& line : normalized.split(QLatin1Char('\n'))) {
        QJsonObject p{{kType, QStringLiteral("paragraph")}};
        if (!line.isEmpty()) p.insert(kContent, QJsonArray{QJsonObject{{kType, QStringLiteral("text")}, {kText, line}}});
        blocks.append(p);
    }
    return QJsonObject{{kType, QStringLiteral("doc")}, {kContent, blocks}};
}

bool looksLikeMarkdown(const QString& text)
{
    static const QRegularExpression re(
        QStringLiteral(R"((^|\n)\s{0,3}(#{1,6}\s|[-*+•]\s|\d+[.)]\s|>\s|```|---\s*($|\n)|\|.*\|)|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))"));
    return re.match(text).hasMatch();
}

}  // namespace noted::doc
