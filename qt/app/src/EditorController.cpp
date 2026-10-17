#include "EditorController.h"

#include <QClipboard>
#include <QDate>
#include <QElapsedTimer>
#include <QGuiApplication>
#include <QJsonDocument>
#include <QMimeData>
#include <QRegularExpression>
#include <QTextBlock>
#include <QTextCursor>
#include <QTextDocument>
#include <QTextDocumentFragment>
#include <QTextFrame>
#include <QTextList>
#include <QTextTable>

#include "noted/NoteStore.h"
#include "noted/doc/Export.h"
#include "noted/doc/Schema.h"
#include "noted/doc/TipTap.h"

using namespace noted;
using namespace noted::doc;

namespace {

const QString kNotedMime = QStringLiteral("application/x-noted-tiptap");

int markProperty(int m)
{
    static const int props[] = {MarkBold, MarkItalic, MarkUnderline, MarkStrike, MarkCode, MarkHighlight};
    return props[m];
}

QTextListFormat::Style bulletStyle(int depth)
{
    switch ((depth - 1) % 3) {
    case 0:  return QTextListFormat::ListDisc;
    case 1:  return QTextListFormat::ListCircle;
    default: return QTextListFormat::ListSquare;
    }
}

int listKindOf(const QTextList* l)
{
    return l ? l->format().intProperty(ListKind) : -1;
}

QTextBlockFormat paragraphFormat(const QTextBlockFormat& from)
{
    QTextBlockFormat bf;
    bf.setProperty(BlockKind, Paragraph);
    const int q = from.intProperty(QTextFormat::BlockQuoteLevel);
    if (q > 0) bf.setProperty(QTextFormat::BlockQuoteLevel, q);
    return bf;
}

QTextCharFormat plainMarks()
{
    QTextCharFormat cf;
    for (int p : {MarkBold, MarkItalic, MarkUnderline, MarkStrike, MarkCode, MarkHighlight}) cf.setProperty(p, false);
    return cf;
}

}  // namespace

EditorController::EditorController(QObject* parent)
    : QObject(parent)
{
    m_restyleTimer.setSingleShot(true);
    m_restyleTimer.setInterval(0);
    connect(&m_restyleTimer, &QTimer::timeout, this, [this] {
        if (m_pendingFrom < 0 || !doc()) return;
        const int from = m_pendingFrom, to = m_pendingTo;
        m_pendingFrom = m_pendingTo = -1;
        restyle(from, to);
        updateFormatState();
        rebuildDecorations();
    });

    m_saveTimer.setSingleShot(true);
    m_saveTimer.setInterval(600);
    connect(&m_saveTimer, &QTimer::timeout, this, &EditorController::save);

    m_statsTimer.setSingleShot(true);
    m_statsTimer.setInterval(250);
    connect(&m_statsTimer, &QTimer::timeout, this, [this] {
        recomputeStats();
        if (!m_findQuery.isEmpty()) rebuildFind();
    });
}

EditorController::~EditorController()
{
    flush();
}

QTextDocument* EditorController::doc() const
{
    return m_quickDoc ? m_quickDoc->textDocument() : nullptr;
}

void EditorController::setTextDocument(QQuickTextDocument* d)
{
    if (d == m_quickDoc) return;
    if (QTextDocument* old = doc()) disconnect(old, nullptr, this, nullptr);
    m_quickDoc = d;
    if (QTextDocument* nd = doc()) {
        m_styler.applyDocumentDefaults(nd);
        connect(nd, &QTextDocument::contentsChange, this, &EditorController::onContentsChange);
    }
    emit textDocumentChanged();
}

void EditorController::setStore(NoteStore* s)
{
    if (s == m_store) return;
    m_store = s;
    emit storeChanged();
}

void EditorController::setFiles(OpenFiles* f)
{
    if (f == m_files) return;
    m_files = f;
    emit filesChanged();
}

void EditorController::setCursorPosition(int p)
{
    if (p == m_cursor) return;
    if (m_pendingMarksAt >= 0 && p != m_pendingMarksAt) {
        m_pendingMarks.clear();
        m_pendingMarksAt = -1;
    }
    m_cursor = p;
    emit cursorPositionChanged();
    updateFormatState();
}

void EditorController::setSelectionStart(int p)
{
    if (p == m_selStart) return;
    m_selStart = p;
    emit selectionChanged();
    updateFormatState();
}

void EditorController::setSelectionEnd(int p)
{
    if (p == m_selEnd) return;
    m_selEnd = p;
    emit selectionChanged();
    updateFormatState();
}

void EditorController::setPalette(const QVariantMap& p)
{
    if (p == m_paletteMap) return;
    m_paletteMap = p;
    Palette pal;
    auto color = [&p](const char* k, QColor& out) {
        if (p.contains(k)) out = p.value(k).value<QColor>();
    };
    if (p.contains("bodyFamily")) pal.bodyFamily = p.value("bodyFamily").toString();
    if (p.contains("monoFamily")) pal.monoFamily = p.value("monoFamily").toString();
    if (p.contains("basePx")) pal.basePx = p.value("basePx").toReal();
    if (p.contains("lineHeight")) pal.lineHeight = p.value("lineHeight").toReal();
    color("text", pal.text);
    color("muted", pal.muted);
    color("subtle", pal.subtle);
    color("accent", pal.accent);
    color("accentText", pal.accentText);
    color("link", pal.link);
    color("inlineCodeBg", pal.inlineCodeBg);
    color("codeBlockBg", pal.codeBlockBg);
    color("highlightBg", pal.highlightBg);
    color("quoteText", pal.quoteText);
    color("rule", pal.rule);
    color("tableBorder", pal.tableBorder);
    color("tableHeaderBg", pal.tableHeaderBg);
    color("checkbox", pal.checkbox);
    color("codeBlockText", pal.codeBlockText);
    color("inlineCodeText", pal.inlineCodeText);
    color("checkedText", pal.checkedText);
    m_styler.setPalette(pal);
    emit paletteChanged();
    restyleAll();
}

// ── lifecycle ─────────────────────────────────────────────────────────────

void EditorController::load(const QString& noteId, const QString& json)
{
    QTextDocument* d = doc();
    if (!d) return;
    flush();
    QElapsedTimer t;
    t.start();
    m_loading = true;
    m_styler.applyDocumentDefaults(d);
    doc::load(d, doc::parse(json));
    const qint64 parsed = t.elapsed();
    {
        QTextCursor batch(d);
        batch.beginEditBlock();
        m_styler.apply(d);
        batch.endEditBlock();
    }
    d->clearUndoRedoStacks();
    d->setModified(false);
    m_loading = false;
    if (t.elapsed() > 40)
        qInfo().noquote() << "slow note load" << noteId << json.size() << "bytes: build" << parsed << "ms, style"
                          << t.elapsed() - parsed << "ms";
    m_pendingFrom = m_pendingTo = -1;
    m_pendingMarks.clear();
    m_pendingMarksAt = -1;
    if (m_noteId != noteId) {
        m_noteId = noteId;
        emit noteIdChanged();
    }
    if (m_dirty) {
        m_dirty = false;
        emit dirtyChanged();
    }
    recomputeStats();
    if (!m_findQuery.isEmpty()) rebuildFind();
    rebuildDecorations();
    // Inserting the content dragged the view's caret to the end; start at the top.
    emit requestCursor(0, 0);
    updateFormatState();
}

void EditorController::unload()
{
    flush();
    if (QTextDocument* d = doc()) {
        m_loading = true;
        d->clear();
        d->clearUndoRedoStacks();
        m_loading = false;
    }
    m_noteId.clear();
    emit noteIdChanged();
    rebuildDecorations();
}

// Theme changes restyle through a save/reload so no styling lands on the
// undo stack (undoing past a theme change would otherwise flip colours).
void EditorController::restyleAll()
{
    QTextDocument* d = doc();
    if (!d || m_noteId.isEmpty()) return;
    const QString json = this->json();
    const bool wasDirty = m_dirty;
    const int pos = m_cursor;
    m_loading = true;
    m_styler.applyDocumentDefaults(d);
    doc::load(d, doc::parse(json));
    m_styler.apply(d);
    d->clearUndoRedoStacks();
    m_loading = false;
    m_dirty = wasDirty;
    emit requestCursor(qMin(pos, d->characterCount() - 1), qMin(pos, d->characterCount() - 1));
}

bool EditorController::flush()
{
    m_saveTimer.stop();
    if (!m_dirty) return false;
    save();
    return true;
}

QString EditorController::json() const
{
    const QTextDocument* d = doc();
    return d ? doc::stringify(doc::save(d)) : QString();
}

QString EditorController::plainText() const
{
    const QTextDocument* d = doc();
    return d ? doc::toPlainText(doc::save(d)) : QString();
}

QString EditorController::markdown() const
{
    const QTextDocument* d = doc();
    return d ? doc::toMarkdown(doc::save(d)) : QString();
}

void EditorController::save()
{
    if (!m_dirty || m_noteId.isEmpty() || !doc()) return;
    const QJsonObject j = doc::save(doc());
    if (OpenFiles::isFile(m_noteId)) {
        if (!m_files || !m_files->writeDoc(m_noteId, j)) return;  // stays dirty; the next edit retries
    } else {
        if (!m_store) return;
        m_store->updateNote(m_noteId, {{"content", doc::stringify(j)}, {"content_plain", doc::toPlainText(j)}});
    }
    m_dirty = false;
    emit dirtyChanged();
    emit saved(m_noteId);
}

void EditorController::markDirty()
{
    if (m_noteId.isEmpty()) return;
    if (!m_dirty) {
        m_dirty = true;
        emit dirtyChanged();
    }
    m_saveTimer.start();
    m_statsTimer.start();
}

void EditorController::recomputeStats()
{
    const QTextDocument* d = doc();
    const QString text = d ? d->toPlainText() : QString();
    static const QRegularExpression ws(QStringLiteral("\\s+"));
    const QString trimmed = text.trimmed();
    const int words = trimmed.isEmpty() ? 0 : int(trimmed.split(ws, Qt::SkipEmptyParts).size());
    const bool empty = trimmed.isEmpty() && (!d || d->blockCount() <= 1);
    QString lead;
    if (d) {
        const QTextBlock first = d->begin();
        const QTextBlockFormat bf = first.blockFormat();
        if (bf.intProperty(BlockKind) == Heading && bf.headingLevel() == 1 && !first.textList())
            lead = first.text().simplified();
    }
    if (words != m_words || empty != m_empty || lead != m_leadingHeading) {
        m_words = words;
        m_empty = empty;
        m_leadingHeading = lead;
        emit statsChanged();
    }
    if (m_dirty && !m_noteId.isEmpty()) emit livePreview(m_noteId, trimmed.left(240));
}

// ── change tracking ───────────────────────────────────────────────────────

void EditorController::onContentsChange(int pos, int removed, int added)
{
    if (m_loading || m_restyling) return;
    markDirty();
    const int end = pos + qMax(added, 1);
    m_pendingFrom = m_pendingFrom < 0 ? pos : qMin(m_pendingFrom, pos);
    m_pendingTo = qMax(m_pendingTo, end);
    // Edits can change neighbouring blocks' spacing (first-in-list etc.).
    if (added != removed) m_pendingTo = qMax(m_pendingTo, end + 1);

    if (added > 0 && added != removed) {
        applyPendingMarks(pos, added);
        if (added == 1 && doc()->characterAt(pos) == QLatin1Char(' ')) {
            QMetaObject::invokeMethod(this, [this, pos] { applyInputRule(pos); }, Qt::QueuedConnection);
        }
    }
    m_restyleTimer.start();
}

void EditorController::restyle(int from, int to)
{
    QTextDocument* d = doc();
    if (!d) return;
    m_restyling = true;
    QTextCursor c(d);
    c.joinPreviousEditBlock();
    const int max = d->characterCount();
    m_styler.apply(d, qBound(0, from, max - 1), qBound(1, to, max));
    c.endEditBlock();
    m_restyling = false;
}

void EditorController::applyPendingMarks(int pos, int added)
{
    if (m_pendingMarks.isEmpty() || pos != m_pendingMarksAt) return;
    QTextCursor c(doc());
    c.setPosition(pos);
    c.setPosition(pos + added, QTextCursor::KeepAnchor);
    QTextCharFormat cf;
    for (auto it = m_pendingMarks.begin(); it != m_pendingMarks.end(); ++it) cf.setProperty(it.key(), it.value());
    m_restyling = true;  // this merge is part of the user's keystroke
    c.joinPreviousEditBlock();
    c.mergeCharFormat(cf);
    c.endEditBlock();
    m_restyling = false;
    m_pendingMarks.clear();
    m_pendingMarksAt = -1;
}

// Markdown-style shortcuts typed at the start of a paragraph.
bool EditorController::applyInputRule(int spacePos)
{
    QTextDocument* d = doc();
    if (!d || spacePos >= d->characterCount() || d->characterAt(spacePos) != QLatin1Char(' ')) return false;
    const QTextBlock b = d->findBlock(spacePos);
    QTextCursor c(b);
    if (codeFrameAt(c) || c.currentTable()) return false;
    const QString prefix = b.text().left(spacePos - b.position());
    if (prefix.isEmpty() || prefix.size() > 6) return false;
    const QTextBlockFormat bf = b.blockFormat();

    int heading = 0, list = -1, start = 1;
    bool quote = false, checked = false;
    static const QRegularExpression ordered(QStringLiteral("^(\\d{1,4})[.)]$"));
    if (prefix == u"#" || prefix == u"##" || prefix == u"###") heading = int(prefix.size());
    else if (prefix == u"-" || prefix == u"*" || prefix == u"+" || prefix == u"•") list = BulletList;
    else if (prefix == u"[]" || prefix == u"[ ]") list = TaskList;
    else if (prefix == u"[x]" || prefix == u"[X]") {
        list = TaskList;
        checked = true;
    } else if (prefix == u">") quote = true;
    else if (auto m = ordered.match(prefix); m.hasMatch()) {
        list = OrderedList;
        start = m.captured(1).toInt();
    } else return false;

    // "- " inside an existing item does nothing; "[ ] " turns a bullet item into a task.
    if (list >= 0 && b.textList() && !(list == TaskList && listKindOf(b.textList()) != TaskList)) return false;
    if (heading && bf.intProperty(BlockKind) == Heading && bf.headingLevel() == heading) return false;

    c.beginEditBlock();
    c.setPosition(b.position());
    c.setPosition(spacePos + 1, QTextCursor::KeepAnchor);
    c.removeSelectedText();
    if (heading) {
        setBlockKind(c, Heading, heading);
    } else if (quote) {
        QTextBlockFormat f = c.blockFormat();
        f.setProperty(QTextFormat::BlockQuoteLevel, qMax(1, f.intProperty(QTextFormat::BlockQuoteLevel) + 1));
        c.setBlockFormat(f);
    } else {
        if (b.textList()) removeFromList(c.block());
        addToList(c.block(), list, 1);
        if (list == OrderedList && start != 1 && c.block().textList()) {
            QTextListFormat lf = c.block().textList()->format();
            lf.setStart(start);
            c.block().textList()->setFormat(lf);
        }
        if (list == TaskList) {
            QTextBlockFormat f = c.blockFormat();
            setTaskChecked(f, checked);
            c.setBlockFormat(f);
        }
    }
    c.endEditBlock();
    emitCursor(c);
    return true;
}

// ── formatting state ──────────────────────────────────────────────────────

QTextCursor EditorController::selectionCursor() const
{
    QTextCursor c(doc());
    const int max = doc()->characterCount() - 1;
    if (m_selStart != m_selEnd) {
        c.setPosition(qBound(0, m_selStart, max));
        c.setPosition(qBound(0, m_selEnd, max), QTextCursor::KeepAnchor);
    } else {
        c.setPosition(qBound(0, m_cursor, max));
    }
    return c;
}

void EditorController::updateFormatState()
{
    QTextDocument* d = doc();
    if (!d) return;
    QTextCursor c = selectionCursor();
    QTextCharFormat cf;
    if (c.hasSelection()) {
        QTextCursor first(d);
        first.setPosition(c.selectionStart() + 1);
        cf = first.charFormat();
    } else {
        cf = c.charFormat();
    }
    for (auto it = m_pendingMarks.begin(); it != m_pendingMarks.end(); ++it) cf.setProperty(it.key(), it.value());
    const QTextBlockFormat bf = c.blockFormat();

    Fmt f;
    f.bold = cf.boolProperty(MarkBold);
    f.italic = cf.boolProperty(MarkItalic);
    f.underline = cf.boolProperty(MarkUnderline);
    f.strike = cf.boolProperty(MarkStrike);
    f.code = cf.boolProperty(MarkCode);
    f.highlight = cf.boolProperty(MarkHighlight);
    f.href = cf.isAnchor() ? cf.anchorHref() : QString();
    f.heading = bf.intProperty(BlockKind) == Heading ? bf.headingLevel() : 0;
    f.list = listKindOf(c.block().textList());
    f.quote = bf.intProperty(QTextFormat::BlockQuoteLevel) > 0;
    f.codeBlock = codeFrameAt(c) != nullptr;
    f.table = c.currentTable() != nullptr;
    if (!(f == m_fmt)) {
        m_fmt = f;
        emit formatChanged();
    }
}

void EditorController::emitCursor(const QTextCursor& c)
{
    emit requestCursor(c.position(), c.anchor());
}

// ── marks ─────────────────────────────────────────────────────────────────

void EditorController::toggleMark(Mark m)
{
    QTextDocument* d = doc();
    if (!d) return;
    const int prop = markProperty(int(m));
    QTextCursor c = selectionCursor();
    if (!c.hasSelection()) {
        // Applies to whatever is typed next at this position.
        const bool current = m_pendingMarks.contains(prop) ? m_pendingMarks.value(prop) : c.charFormat().boolProperty(prop);
        m_pendingMarks.insert(prop, !current);
        m_pendingMarksAt = c.position();
        updateFormatState();
        return;
    }
    // On if any selected character lacks it, otherwise off.
    bool allOn = true;
    for (QTextBlock b = d->findBlock(c.selectionStart()); b.isValid() && b.position() < c.selectionEnd(); b = b.next()) {
        for (auto it = b.begin(); !it.atEnd(); ++it) {
            const QTextFragment f = it.fragment();
            if (f.position() + f.length() <= c.selectionStart() || f.position() >= c.selectionEnd()) continue;
            if (!f.charFormat().boolProperty(prop)) allOn = false;
        }
    }
    QTextCharFormat cf;
    cf.setProperty(prop, !allOn);
    c.mergeCharFormat(cf);
}

void EditorController::setLink(const QString& href)
{
    QTextCursor c = selectionCursor();
    if (!c.hasSelection()) {
        // Expand to the link under the caret.
        const QTextBlock b = c.block();
        for (auto it = b.begin(); !it.atEnd(); ++it) {
            const QTextFragment f = it.fragment();
            if (f.charFormat().isAnchor() && c.position() >= f.position() && c.position() <= f.position() + f.length()) {
                c.setPosition(f.position());
                c.setPosition(f.position() + f.length(), QTextCursor::KeepAnchor);
                break;
            }
        }
    }
    if (!c.hasSelection()) {
        if (href.isEmpty()) return;
        // No selection: insert the URL itself as a link.
        QTextCharFormat cf = c.charFormat();
        cf.setAnchor(true);
        cf.setAnchorHref(href);
        c.insertText(href, cf);
        return;
    }
    QTextCharFormat cf;
    if (href.isEmpty()) {
        cf.setAnchor(false);
        cf.setAnchorHref(QString());
        cf.setProperty(MarkLinkAttrs, QString());
        c.mergeCharFormat(cf);
        // mergeCharFormat can't clear properties; strip them explicitly.
        QTextCursor walk(doc());
        for (int p = c.selectionStart(); p < c.selectionEnd(); ++p) {
            walk.setPosition(p);
            walk.setPosition(p + 1, QTextCursor::KeepAnchor);
            QTextCharFormat f = walk.charFormat();
            f.clearProperty(QTextFormat::AnchorHref);
            f.clearProperty(QTextFormat::IsAnchor);
            f.clearProperty(MarkLinkAttrs);
            walk.setCharFormat(f);
        }
        return;
    }
    cf.setAnchor(true);
    cf.setAnchorHref(href);
    cf.setProperty(MarkLinkAttrs, doc::stringify(QJsonObject{{"href", href},
                                                              {"target", "_blank"},
                                                              {"rel", "noopener noreferrer nofollow"},
                                                              {"class", QJsonValue::Null},
                                                              {"title", QJsonValue::Null}}));
    c.mergeCharFormat(cf);
}

QString EditorController::linkAt(int position) const
{
    QTextDocument* d = doc();
    if (!d) return {};
    QTextCursor c(d);
    c.setPosition(qBound(0, position + 1, d->characterCount() - 1));
    const QTextCharFormat cf = c.charFormat();
    return cf.isAnchor() ? cf.anchorHref() : QString();
}

void EditorController::clearFormatting()
{
    QTextCursor c = selectionCursor();
    if (!c.hasSelection()) return;
    c.mergeCharFormat(plainMarks());
}

// ── blocks ────────────────────────────────────────────────────────────────

void EditorController::setBlockKind(QTextCursor& c, int kind, int headingLevel)
{
    QTextBlockFormat f = c.blockFormat();
    f.setProperty(BlockKind, kind);
    f.setHeadingLevel(kind == Heading ? headingLevel : 0);
    f.clearProperty(BlockNodeAttrs);
    if (kind == Heading) f.setProperty(BlockNodeAttrs, doc::stringify(QJsonObject{{"level", headingLevel}}));
    c.setBlockFormat(f);
}

void EditorController::setHeading(int level)
{
    QTextCursor sel = selectionCursor();
    QTextDocument* d = doc();
    const bool toggleOff = level > 0 && m_fmt.heading == level;
    sel.beginEditBlock();
    for (QTextBlock b = d->findBlock(sel.selectionStart()); b.isValid(); b = b.next()) {
        QTextCursor c(b);
        if (!codeFrameAt(c)) {
            if (toggleOff || level == 0) setBlockKind(c, Paragraph);
            else setBlockKind(c, Heading, level);
        }
        if (b.contains(sel.selectionEnd()) || b.position() > sel.selectionEnd()) break;
    }
    sel.endEditBlock();
}

void EditorController::removeFromList(const QTextBlock& b)
{
    QTextList* l = b.textList();
    if (!l) return;
    l->remove(b);
    QTextCursor c(b);
    QTextBlockFormat f = c.blockFormat();
    f.setIndent(0);
    clearTask(f);
    f.clearProperty(BlockItemAttrs);
    f.clearProperty(BlockListContinuation);
    c.setBlockFormat(f);
}

// Finds the list a block at `depth` should join: walking up from `near`
// through list items/continuations that are at least that deep.
QTextList* EditorController::listForDepth(const QTextBlock& near, int kind, int depth) const
{
    for (QTextBlock p = near; p.isValid(); p = p.previous()) {
        QTextList* l = p.textList();
        const int cont = p.blockFormat().intProperty(BlockListContinuation);
        if (!l && cont <= 0) return nullptr;
        const int pd = l ? l->format().indent() : cont;
        if (pd < depth) return nullptr;
        if (l && pd == depth) return listKindOf(l) == kind ? l : nullptr;
    }
    return nullptr;
}

void EditorController::addToList(const QTextBlock& b, int kind, int depth)
{
    QTextCursor c(b);
    if (QTextList* l = listForDepth(b.previous(), kind, depth)) {
        l->add(b);
    } else {
        QTextListFormat lf;
        lf.setIndent(depth);
        lf.setProperty(ListKind, kind);
        if (kind == OrderedList) {
            lf.setStyle(QTextListFormat::ListDecimal);
            lf.setProperty(ListNodeAttrs, doc::stringify(QJsonObject{{"start", 1}, {"type", QJsonValue::Null}}));
        } else {
            lf.setStyle(bulletStyle(depth));
        }
        c.createList(lf);
    }
    QTextBlockFormat f = c.blockFormat();
    f.clearProperty(BlockListContinuation);
    if (kind == TaskList) setTaskChecked(f, taskChecked(f));
    else clearTask(f);
    if (f.intProperty(BlockKind) == HorizontalRule) f.setProperty(BlockKind, Paragraph);
    c.setBlockFormat(f);
}

void EditorController::toggleList(int kind)
{
    QTextDocument* d = doc();
    QTextCursor sel = selectionCursor();
    if (codeFrameAt(sel)) return;
    QList<QTextBlock> blocks;
    for (QTextBlock b = d->findBlock(sel.selectionStart()); b.isValid(); b = b.next()) {
        blocks << b;
        if (b.contains(sel.selectionEnd()) || b.position() >= sel.selectionEnd()) break;
    }
    bool allKind = true;
    for (const QTextBlock& b : blocks)
        if (listKindOf(b.textList()) != kind) allKind = false;

    sel.beginEditBlock();
    if (allKind) {
        for (const QTextBlock& b : blocks) removeFromList(b);
    } else {
        QSet<QTextList*> converted;
        for (const QTextBlock& b : blocks) {
            QTextList* l = b.textList();
            if (l && listKindOf(l) != kind && !converted.contains(l)) {
                // Convert the whole list, like TipTap's toggleList.
                QTextListFormat lf = l->format();
                lf.setProperty(ListKind, kind);
                lf.setStyle(kind == OrderedList ? QTextListFormat::ListDecimal : bulletStyle(lf.indent()));
                l->setFormat(lf);
                for (int i = 0; i < l->count(); ++i) {
                    QTextCursor ic(l->item(i));
                    QTextBlockFormat f = ic.blockFormat();
                    if (kind == TaskList) setTaskChecked(f, false);
                    else clearTask(f);
                    ic.setBlockFormat(f);
                }
                converted.insert(l);
            } else if (!l) {
                QTextCursor c(b);
                if (c.blockFormat().intProperty(BlockKind) == Heading) setBlockKind(c, Paragraph);
                addToList(b, kind, 1);
            }
        }
    }
    sel.endEditBlock();
}

void EditorController::toggleQuote()
{
    QTextDocument* d = doc();
    QTextCursor sel = selectionCursor();
    QList<QTextBlock> blocks;
    for (QTextBlock b = d->findBlock(sel.selectionStart()); b.isValid(); b = b.next()) {
        blocks << b;
        if (b.contains(sel.selectionEnd()) || b.position() >= sel.selectionEnd()) break;
    }
    bool allQuoted = true;
    for (const QTextBlock& b : blocks)
        if (b.blockFormat().intProperty(QTextFormat::BlockQuoteLevel) <= 0) allQuoted = false;
    sel.beginEditBlock();
    for (const QTextBlock& b : blocks) {
        QTextCursor c(b);
        QTextBlockFormat f = c.blockFormat();
        if (allQuoted) f.clearProperty(QTextFormat::BlockQuoteLevel);
        else f.setProperty(QTextFormat::BlockQuoteLevel, 1);
        c.setBlockFormat(f);
    }
    sel.endEditBlock();
}

QTextFrame* EditorController::codeFrameAt(const QTextCursor& c) const
{
    QTextFrame* f = c.currentFrame();
    return f && f->frameFormat().intProperty(FrameKind) == CodeBlockFrame ? f : nullptr;
}

void EditorController::wrapInCodeFrame(QTextCursor& sel)
{
    QTextDocument* d = doc();
    const QTextBlock first = d->findBlock(sel.selectionStart());
    const QTextBlock last = d->findBlock(sel.selectionEnd());
    QStringList lines;
    for (QTextBlock b = first; b.isValid(); b = b.next()) {
        lines << b.text().replace(QChar::LineSeparator, QLatin1Char('\n'));
        if (b == last) break;
    }
    QTextCursor c(d);
    c.beginEditBlock();
    c.setPosition(first.position());
    c.setPosition(last.position() + last.length() - 1, QTextCursor::KeepAnchor);
    c.removeSelectedText();
    removeFromList(c.block());
    QTextBlockFormat scaffold;
    scaffold.setProperty(BlockScaffold, true);
    c.setBlockFormat(scaffold);
    c.setBlockCharFormat(plainMarks());

    QTextFrameFormat ff;
    ff.setProperty(FrameKind, CodeBlockFrame);
    ff.setProperty(FrameNodeAttrs, doc::stringify(QJsonObject{{"language", QJsonValue::Null}}));
    QTextFrame* frame = c.insertFrame(ff);
    const QString joined = lines.join(QLatin1Char('\n'));
    const QStringList split = joined.split(QLatin1Char('\n'));
    QTextBlockFormat bf;
    bf.setProperty(BlockKind, Paragraph);
    for (int i = 0; i < split.size(); ++i) {
        if (i == 0) {
            c.setBlockFormat(bf);
            c.setBlockCharFormat(plainMarks());
        } else {
            c.insertBlock(bf, plainMarks());
        }
        c.insertText(split[i], plainMarks());
    }
    // Make sure there is somewhere to type after the block.
    QTextCursor after = frame->lastCursorPosition();
    after.movePosition(QTextCursor::NextBlock);
    QTextBlockFormat pf;
    pf.setProperty(BlockKind, Paragraph);
    after.setBlockFormat(pf);
    c.endEditBlock();
    emitCursor(c);
}

void EditorController::unwrapCodeFrame(QTextFrame* f)
{
    QStringList lines;
    for (auto it = f->begin(); !it.atEnd(); ++it)
        if (it.currentBlock().isValid()) lines << it.currentBlock().text();
    QTextCursor c(doc());
    c.beginEditBlock();
    c.setPosition(f->firstPosition() - 1);
    c.setPosition(f->lastPosition() + 1, QTextCursor::KeepAnchor);
    c.removeSelectedText();
    QTextBlockFormat bf;
    bf.setProperty(BlockKind, Paragraph);
    c.setBlockFormat(bf);
    for (int i = 0; i < lines.size(); ++i) {
        if (i > 0) c.insertBlock(bf, plainMarks());
        c.insertText(lines[i], plainMarks());
    }
    c.endEditBlock();
    emitCursor(c);
}

void EditorController::toggleCodeBlock()
{
    QTextCursor sel = selectionCursor();
    if (QTextFrame* f = codeFrameAt(sel)) {
        unwrapCodeFrame(f);
        return;
    }
    if (sel.currentTable()) return;
    wrapInCodeFrame(sel);
}

void EditorController::insertHorizontalRule()
{
    QTextCursor c = selectionCursor();
    if (codeFrameAt(c) || c.currentTable()) return;
    c.beginEditBlock();
    QTextBlockFormat hr;
    hr.setProperty(BlockKind, HorizontalRule);
    hr.setProperty(QTextFormat::BlockTrailingHorizontalRulerWidth, QTextLength(QTextLength::PercentageLength, 100));
    if (c.block().text().isEmpty() && !c.block().textList()) {
        c.setBlockFormat(hr);
    } else {
        c.movePosition(QTextCursor::EndOfBlock);
        c.insertBlock(hr, plainMarks());
    }
    c.insertBlock(paragraphFormat(QTextBlockFormat()), plainMarks());
    c.endEditBlock();
    emitCursor(c);
}

void EditorController::insertTable(int rows, int cols)
{
    QTextCursor c = selectionCursor();
    if (codeFrameAt(c) || c.currentTable()) return;
    c.beginEditBlock();
    if (!c.block().text().isEmpty()) {
        c.movePosition(QTextCursor::EndOfBlock);
        c.insertBlock(paragraphFormat(QTextBlockFormat()), plainMarks());
    }
    QTextBlockFormat scaffold;
    scaffold.setProperty(BlockScaffold, true);
    c.setBlockFormat(scaffold);
    QTextTableFormat tf;
    tf.setBorderCollapse(true);
    tf.setWidth(QTextLength(QTextLength::PercentageLength, 100));
    QTextTable* t = c.insertTable(rows, cols, tf);
    const QString attrs = doc::stringify(QJsonObject{{"colspan", 1}, {"rowspan", 1}, {"colwidth", QJsonValue::Null}});
    for (int r = 0; r < rows; ++r) {
        for (int col = 0; col < cols; ++col) {
            QTextTableCell cell = t->cellAt(r, col);
            QTextCharFormat cf = cell.format();
            cf.setProperty(CellIsHeader, r == 0);
            cf.setProperty(CellNodeAttrs, attrs);
            cell.setFormat(cf);
            QTextCursor cc = cell.firstCursorPosition();
            QTextBlockFormat bf;
            bf.setProperty(BlockKind, Paragraph);
            cc.setBlockFormat(bf);
        }
    }
    QTextCursor after = t->lastCursorPosition();
    after.movePosition(QTextCursor::NextBlock);
    after.setBlockFormat(paragraphFormat(QTextBlockFormat()));
    c.endEditBlock();
    emitCursor(t->cellAt(0, 0).firstCursorPosition());
}

void EditorController::tableInsertRow(bool below)
{
    QTextCursor c = selectionCursor();
    QTextTable* t = c.currentTable();
    if (!t) return;
    const QTextTableCell cell = t->cellAt(c);
    const int row = below ? cell.row() + cell.rowSpan() : cell.row();
    t->insertRows(row, 1);
    const QString attrs = doc::stringify(QJsonObject{{"colspan", 1}, {"rowspan", 1}, {"colwidth", QJsonValue::Null}});
    for (int col = 0; col < t->columns(); ++col) {
        QTextTableCell nc = t->cellAt(row, col);
        QTextCharFormat cf = nc.format();
        cf.setProperty(CellIsHeader, false);
        cf.setProperty(CellNodeAttrs, attrs);
        nc.setFormat(cf);
    }
}

void EditorController::tableRemoveRow()
{
    QTextCursor c = selectionCursor();
    QTextTable* t = c.currentTable();
    if (!t) return;
    t->removeRows(t->cellAt(c).row(), 1);
}

void EditorController::tableInsertColumn(bool after)
{
    QTextCursor c = selectionCursor();
    QTextTable* t = c.currentTable();
    if (!t) return;
    const QTextTableCell cell = t->cellAt(c);
    const int col = after ? cell.column() + cell.columnSpan() : cell.column();
    t->insertColumns(col, 1);
    const QString attrs = doc::stringify(QJsonObject{{"colspan", 1}, {"rowspan", 1}, {"colwidth", QJsonValue::Null}});
    for (int r = 0; r < t->rows(); ++r) {
        QTextTableCell nc = t->cellAt(r, col);
        QTextCharFormat cf = nc.format();
        cf.setProperty(CellIsHeader, r == 0 && t->cellAt(0, qMax(0, col - 1)).format().boolProperty(CellIsHeader));
        cf.setProperty(CellNodeAttrs, attrs);
        nc.setFormat(cf);
    }
}

void EditorController::tableRemoveColumn()
{
    QTextCursor c = selectionCursor();
    QTextTable* t = c.currentTable();
    if (!t) return;
    t->removeColumns(t->cellAt(c).column(), 1);
}

void EditorController::tableDelete()
{
    QTextCursor c = selectionCursor();
    QTextTable* t = c.currentTable();
    if (!t) return;
    QTextCursor after = t->lastCursorPosition();
    after.movePosition(QTextCursor::NextBlock);
    const int pos = t->firstPosition() - 1;
    t->removeRows(0, t->rows());
    QTextCursor at(doc());
    at.setPosition(qBound(0, pos, doc()->characterCount() - 1));
    emitCursor(at);
}

void EditorController::indent()
{
    QTextCursor sel = selectionCursor();
    QTextDocument* d = doc();
    sel.beginEditBlock();
    for (QTextBlock b = d->findBlock(sel.selectionStart()); b.isValid(); b = b.next()) {
        QTextList* l = b.textList();
        if (l) {
            const int depth = l->format().indent();
            const int kind = listKindOf(l);
            // Only nest under an existing item.
            if (depth < 6 && b.previous().isValid() && (b.previous().textList() || b.previous().blockFormat().intProperty(BlockListContinuation) > 0)) {
                const bool wasChecked = taskChecked(b.blockFormat());
                l->remove(b);
                QTextCursor c(b);
                QTextBlockFormat f = c.blockFormat();
                f.setIndent(0);
                c.setBlockFormat(f);
                addToList(b, kind, depth + 1);
                QTextBlockFormat f2 = QTextCursor(b).blockFormat();
                if (kind == TaskList) setTaskChecked(f2, wasChecked);
                QTextCursor(b).setBlockFormat(f2);
            }
        }
        if (b.contains(sel.selectionEnd()) || b.position() >= sel.selectionEnd()) break;
    }
    sel.endEditBlock();
}

void EditorController::outdent()
{
    QTextCursor sel = selectionCursor();
    QTextDocument* d = doc();
    sel.beginEditBlock();
    for (QTextBlock b = d->findBlock(sel.selectionStart()); b.isValid(); b = b.next()) {
        QTextList* l = b.textList();
        if (l) {
            const int depth = l->format().indent();
            const int kind = listKindOf(l);
            if (depth <= 1) {
                removeFromList(b);
            } else {
                const bool wasChecked = taskChecked(b.blockFormat());
                l->remove(b);
                QTextCursor c(b);
                QTextBlockFormat f = c.blockFormat();
                f.setIndent(0);
                c.setBlockFormat(f);
                addToList(b, kind, depth - 1);
                QTextBlockFormat f2 = QTextCursor(b).blockFormat();
                if (kind == TaskList) setTaskChecked(f2, wasChecked);
                QTextCursor(b).setBlockFormat(f2);
            }
        }
        if (b.contains(sel.selectionEnd()) || b.position() >= sel.selectionEnd()) break;
    }
    sel.endEditBlock();
}

void EditorController::alignLeft()
{
    QTextDocument* d = doc();
    QTextCursor sel = selectionCursor();
    const bool whole = !sel.hasSelection();
    QTextBlock b = whole ? d->begin() : d->findBlock(sel.selectionStart());
    const int stop = whole ? d->characterCount() : sel.selectionEnd();
    QTextCursor c(d);
    c.beginEditBlock();
    for (; b.isValid() && b.position() <= stop; b = b.next()) {
        const QString t = b.text();
        int n = 0;
        while (n < t.size() && (t[n] == QLatin1Char(' ') || t[n] == QLatin1Char('\t') || t[n] == QChar(0xA0))) ++n;
        if (n == 0) continue;
        c.setPosition(b.position());
        c.setPosition(b.position() + n, QTextCursor::KeepAnchor);
        c.removeSelectedText();
    }
    c.endEditBlock();
}

// Turns typed-out structure into the real thing: "- a" / "1. b" / "[ ] c" /
// "- [x] d" into lists and checkboxes, "# Title" and "=== Title ===" into
// headings. Optionally collapses runs of empty paragraphs.
void EditorController::formatTypedMarkup(int firstBlock, int lastBlock, bool collapseBlank)
{
    QTextDocument* d = doc();
    if (!d) return;
    static const QRegularExpression task(QStringLiteral(R"(^\s*(?:[-*•]\s+)?\[( |x|X)\]\s+)"));
    static const QRegularExpression bullet(QStringLiteral(R"(^\s*[-*•]\s+)"));
    static const QRegularExpression ordered(QStringLiteral(R"(^\s*\d{1,4}[.)]\s+)"));
    static const QRegularExpression hashes(QStringLiteral(R"(^\s*(#{1,3})\s+)"));
    static const QRegularExpression banner(QStringLiteral(R"(^\s*([=\-])\1{2,}\s*(\S.*?)\s*\1{3,}\s*$)"));
    QTextCursor c(d);
    c.beginEditBlock();
    QTextBlock b = d->findBlockByNumber(qMax(0, firstBlock));
    const QTextBlock stop = d->findBlockByNumber(lastBlock).next();
    bool prevEmpty = false;
    while (b.isValid() && b != stop) {
        QTextBlock next = b.next();
        QTextCursor bc(b);
        const bool plainBlock = !b.textList() && !codeFrameAt(bc) && !bc.currentTable()
                                && b.blockFormat().intProperty(BlockKind) == Paragraph;
        const QString t = b.text();
        if (plainBlock && t.trimmed().isEmpty()) {
            if (collapseBlank && prevEmpty && next.isValid()) {
                // Remove the block with the break before it. (select(BlockUnderCursor)
                // selects nothing in an empty block.)
                bc.setPosition(b.position() - 1);
                bc.setPosition(b.position() + b.length() - 1, QTextCursor::KeepAnchor);
                bc.removeSelectedText();
            }
            prevEmpty = true;
            b = next;
            continue;
        }
        prevEmpty = false;
        if (plainBlock) {
            int kind = -1, level = 0;
            bool checked = false;
            QString heading;
            QRegularExpressionMatch m;
            if ((m = task.match(t)).hasMatch()) {
                kind = TaskList;
                checked = m.captured(1).compare(QStringLiteral("x"), Qt::CaseInsensitive) == 0;
            } else if ((m = bullet.match(t)).hasMatch()) {
                kind = BulletList;
            } else if ((m = ordered.match(t)).hasMatch()) {
                kind = OrderedList;
            } else if ((m = hashes.match(t)).hasMatch()) {
                level = int(m.captured(1).size());
                heading = t.mid(m.capturedLength());
            } else if ((m = banner.match(t)).hasMatch()) {
                level = 2;
                heading = m.captured(2);
            }
            if (level > 0) {
                bc.setPosition(b.position());
                bc.setPosition(b.position() + int(t.size()), QTextCursor::KeepAnchor);
                bc.insertText(heading, plainMarks());
                bc.setPosition(b.position());
                setBlockKind(bc, Heading, level);
            } else if (kind >= 0) {
                bc.setPosition(b.position());
                bc.setPosition(b.position() + m.capturedLength(), QTextCursor::KeepAnchor);
                bc.removeSelectedText();
                addToList(b, kind, 1);
                if (kind == TaskList) {
                    QTextCursor tc(b);
                    QTextBlockFormat f = tc.blockFormat();
                    setTaskChecked(f, checked);
                    tc.setBlockFormat(f);
                }
            }
        }
        b = next;
    }
    c.endEditBlock();
}

void EditorController::cleanAndFormat()
{
    QTextDocument* d = doc();
    if (d) formatTypedMarkup(0, d->blockCount() - 1, true);
}

void EditorController::insertDate()
{
    QTextCursor c = selectionCursor();
    c.insertText(QLocale(QLocale::English).toString(QDate::currentDate(), QStringLiteral("dddd, MMMM d, yyyy")));
    emitCursor(c);
}

// ── keys ──────────────────────────────────────────────────────────────────

bool EditorController::handleEnter(bool shift)
{
    QTextDocument* d = doc();
    if (!d) return false;
    QTextCursor c = selectionCursor();
    c.beginEditBlock();
    if (c.hasSelection()) c.removeSelectedText();
    const QTextBlock b = c.block();
    const QTextBlockFormat bf = b.blockFormat();

    // ── code blocks ──────────────────────────────────────────────────
    if (QTextFrame* f = codeFrameAt(c)) {
        const bool lastInFrame = b.next().isValid() && QTextCursor(b.next()).currentFrame() != f;
        const bool firstInFrame = !b.previous().isValid() || QTextCursor(b.previous()).currentFrame() != f;
        if (!shift && b.text().isEmpty() && lastInFrame && !firstInFrame) {
            // Enter on a trailing empty line leaves the block.
            QTextCursor del(d);
            del.setPosition(b.previous().position() + b.previous().length() - 1);
            del.setPosition(b.position(), QTextCursor::KeepAnchor);
            del.removeSelectedText();
            QTextCursor after = f->lastCursorPosition();
            after.movePosition(QTextCursor::NextBlock);
            if (!after.block().text().isEmpty()) {
                after.insertBlock(paragraphFormat(QTextBlockFormat()), plainMarks());
                after.movePosition(QTextCursor::PreviousBlock);
            }
            after.setBlockFormat(paragraphFormat(QTextBlockFormat()));
            c.endEditBlock();
            emitCursor(after);
            return true;
        }
        // Keep the current line's indentation.
        QString indent;
        for (QChar ch : b.text()) {
            if (ch != QLatin1Char(' ') && ch != QLatin1Char('\t')) break;
            indent += ch;
        }
        c.insertBlock(bf, plainMarks());
        if (!indent.isEmpty()) c.insertText(indent, plainMarks());
        c.endEditBlock();
        emitCursor(c);
        return true;
    }

    if (shift) {
        c.insertText(QString(QChar::LineSeparator));
        c.endEditBlock();
        emitCursor(c);
        return true;
    }

    // ── markdown block shortcuts completed by Enter ──────────────────
    const QString text = b.text().trimmed();
    if (!b.textList() && !c.currentTable() && c.atBlockEnd()) {
        static const QRegularExpression fence(QStringLiteral("^```([\\w+-]*)$"));
        if (auto m = fence.match(text); m.hasMatch()) {
            QTextCursor sel(b);
            sel.select(QTextCursor::BlockUnderCursor);
            QTextCursor clear(b);
            clear.movePosition(QTextCursor::EndOfBlock, QTextCursor::KeepAnchor);
            clear.removeSelectedText();
            QTextCursor one(b);
            c.endEditBlock();
            wrapInCodeFrame(one);
            if (!m.captured(1).isEmpty()) {
                if (QTextFrame* f = codeFrameAt(QTextCursor(d->findBlock(m_cursor)))) {
                    QTextFrameFormat ff = f->frameFormat();
                    ff.setProperty(FrameNodeAttrs, doc::stringify(QJsonObject{{"language", m.captured(1)}}));
                    f->setFrameFormat(ff);
                }
            }
            return true;
        }
        if (text == u"---" || text == u"***" || text == u"___") {
            QTextCursor clear(b);
            clear.movePosition(QTextCursor::EndOfBlock, QTextCursor::KeepAnchor);
            clear.removeSelectedText();
            c.endEditBlock();
            insertHorizontalRule();
            return true;
        }
    }

    // ── lists ────────────────────────────────────────────────────────
    if (QTextList* l = b.textList()) {
        if (b.text().isEmpty()) {
            c.endEditBlock();
            if (l->format().indent() > 1) outdent();
            else {
                QTextCursor cc(b);
                cc.beginEditBlock();
                removeFromList(b);
                cc.endEditBlock();
            }
            return true;
        }
        QTextBlockFormat nf = bf;
        nf.clearProperty(BlockItemAttrs);
        nf.clearProperty(BlockNodeAttrs);
        if (listKindOf(l) == TaskList) setTaskChecked(nf, false);
        if (nf.intProperty(BlockKind) == Heading) {
            nf.setProperty(BlockKind, Paragraph);
            nf.setHeadingLevel(0);
        }
        QTextCharFormat cf = c.charFormat();
        cf.setAnchor(false);
        cf.clearProperty(QTextFormat::AnchorHref);
        c.insertBlock(nf, cf);
        c.endEditBlock();
        emitCursor(c);
        return true;
    }

    // ── empty quote line leaves the quote ────────────────────────────
    const int quote = bf.intProperty(QTextFormat::BlockQuoteLevel);
    if (quote > 0 && b.text().isEmpty()) {
        QTextBlockFormat nf = bf;
        if (quote > 1) nf.setProperty(QTextFormat::BlockQuoteLevel, quote - 1);
        else nf.clearProperty(QTextFormat::BlockQuoteLevel);
        c.setBlockFormat(nf);
        c.endEditBlock();
        emitCursor(c);
        return true;
    }

    // ── headings and paragraphs ──────────────────────────────────────
    QTextBlockFormat nf = bf;
    nf.clearProperty(BlockNodeAttrs);
    QTextCharFormat cf = c.charFormat();
    cf.setAnchor(false);
    cf.clearProperty(QTextFormat::AnchorHref);
    cf.clearProperty(MarkLinkAttrs);
    if (bf.intProperty(BlockKind) == Heading || bf.intProperty(BlockKind) == HorizontalRule) {
        if (c.atBlockStart() && !b.text().isEmpty() && bf.intProperty(BlockKind) == Heading) {
            // Enter at the start of a heading pushes it down.
            c.insertBlock(bf, cf);
            QTextCursor above(c.block().previous());
            QTextBlockFormat pf = paragraphFormat(bf);
            above.setBlockFormat(pf);
            c.endEditBlock();
            emitCursor(c);
            return true;
        }
        nf = paragraphFormat(bf);
        cf = plainMarks();
    }
    nf.clearProperty(BlockScaffold);
    c.insertBlock(nf, cf);
    c.endEditBlock();
    emitCursor(c);
    return true;
}

bool EditorController::handleBackspace()
{
    QTextDocument* d = doc();
    if (!d) return false;
    QTextCursor c = selectionCursor();
    if (c.hasSelection() || !c.atBlockStart()) return false;
    const QTextBlock b = c.block();
    const QTextBlockFormat bf = b.blockFormat();

    if (b.textList()) {
        c.beginEditBlock();
        if (b.textList()->format().indent() > 1) {
            c.endEditBlock();
            outdent();
        } else {
            removeFromList(b);
            c.endEditBlock();
        }
        return true;
    }
    if (bf.intProperty(BlockKind) == Heading) {
        setBlockKind(c, Paragraph);
        return true;
    }
    const int quote = bf.intProperty(QTextFormat::BlockQuoteLevel);
    if (quote > 0) {
        QTextBlockFormat nf = bf;
        if (quote > 1) nf.setProperty(QTextFormat::BlockQuoteLevel, quote - 1);
        else nf.clearProperty(QTextFormat::BlockQuoteLevel);
        c.setBlockFormat(nf);
        return true;
    }
    if (bf.intProperty(BlockListContinuation) > 0) {
        QTextBlockFormat nf = bf;
        nf.clearProperty(BlockListContinuation);
        c.setBlockFormat(nf);
        return true;
    }
    // Backspace right after a horizontal rule deletes the rule.
    const QTextBlock prev = b.previous();
    if (prev.isValid() && prev.blockFormat().intProperty(BlockKind) == HorizontalRule
        && QTextCursor(prev).currentFrame() == c.currentFrame()) {
        QTextCursor del(d);
        del.setPosition(prev.position());
        del.setPosition(b.position(), QTextCursor::KeepAnchor);
        del.removeSelectedText();
        emitCursor(del);
        return true;
    }
    return false;
}

bool EditorController::handleTab(bool shift)
{
    QTextCursor c = selectionCursor();
    if (c.block().textList()) {
        shift ? outdent() : indent();
        return true;
    }
    if (codeFrameAt(c)) {
        if (shift) {
            QTextCursor lc(c.block());
            const QString t = c.block().text();
            int n = 0;
            while (n < 4 && n < t.size() && t[n] == QLatin1Char(' ')) ++n;
            if (n > 0) {
                lc.setPosition(c.block().position() + n, QTextCursor::KeepAnchor);
                lc.removeSelectedText();
            }
        } else {
            c.insertText(QStringLiteral("    "));
            emitCursor(c);
        }
        return true;
    }
    if (QTextTable* t = c.currentTable()) {
        QTextTableCell cell = t->cellAt(c);
        int r = cell.row(), col = cell.column() + (shift ? -1 : cell.columnSpan());
        if (col >= t->columns()) {
            col = 0;
            ++r;
        } else if (col < 0) {
            col = t->columns() - 1;
            --r;
        }
        if (r >= t->rows()) {
            tableInsertRow(true);
        }
        if (r < 0) return true;
        QTextCursor nc = t->cellAt(r, col).lastCursorPosition();
        emitCursor(nc);
        return true;
    }
    return false;
}

void EditorController::rebuildDecorations()
{
    QVariantList out;
    if (QTextDocument* d = doc()) {
        int quoteStart = -1, quoteEnd = -1;
        QTextFrame* quoteFrame = nullptr;
        auto flushQuote = [&] {
            if (quoteStart >= 0) out.append(QVariantMap{{"k", "quote"}, {"block", quoteStart}, {"endBlock", quoteEnd}});
            quoteStart = quoteEnd = -1;
        };
        for (QTextBlock b = d->begin(); b.isValid(); b = b.next()) {
            if (listKindOf(b.textList()) == TaskList)
                out.append(QVariantMap{{"k", "task"}, {"block", b.blockNumber()}, {"checked", taskChecked(b.blockFormat())}});
            QTextFrame* f = QTextCursor(b).currentFrame();
            const bool quoted = b.blockFormat().intProperty(QTextFormat::BlockQuoteLevel) > 0;
            if (quoted && quoteStart >= 0 && f == quoteFrame) {
                quoteEnd = b.blockNumber();
            } else {
                flushQuote();
                if (quoted) {
                    quoteStart = quoteEnd = b.blockNumber();
                    quoteFrame = f;
                }
            }
        }
        flushQuote();
    }
    ++m_layoutTick;
    emit layoutTickChanged();
    if (out != m_decorations) {
        m_decorations = out;
        emit decorationsChanged();
    }
}

QVariantMap EditorController::blockGeometry(int blockNumber, int tick) const
{
    Q_UNUSED(tick)
    const QTextDocument* d = doc();
    if (!d) return {};
    const QTextBlock b = d->findBlockByNumber(blockNumber);
    if (!b.isValid()) return {};
    return {{"start", b.position()}, {"end", b.position() + qMax(0, b.length() - 1)}};
}

bool EditorController::toggleTask(int blockNumber)
{
    QTextDocument* d = doc();
    if (!d) return false;
    const QTextBlock b = d->findBlockByNumber(blockNumber);
    if (!b.isValid() || listKindOf(b.textList()) != TaskList) return false;
    QTextCursor c(b);
    QTextBlockFormat bf = c.blockFormat();
    setTaskChecked(bf, !taskChecked(bf));
    c.setBlockFormat(bf);
    return true;
}

int EditorController::blockStart(int position) const
{
    const QTextDocument* d = doc();
    return d ? d->findBlock(position).position() : 0;
}

bool EditorController::isTaskBlock(int position) const
{
    const QTextDocument* d = doc();
    if (!d) return false;
    const QTextBlock b = d->findBlock(position);
    return listKindOf(b.textList()) == TaskList;
}

bool EditorController::clickAt(int position, qreal x, qreal lineX)
{
    QTextDocument* d = doc();
    if (!d) return false;
    // Inline checkbox glyph at or just before the click.
    for (int p : {position, position - 1}) {
        if (p < 0 || p >= d->characterCount() - 1) continue;
        QTextCursor c(d);
        c.setPosition(p);
        c.setPosition(p + 1, QTextCursor::KeepAnchor);
        QTextCharFormat cf = c.charFormat();
        if (!cf.boolProperty(InlineCheckbox)) continue;
        const bool checked = !cf.boolProperty(InlineCheckboxChecked);
        cf.setProperty(InlineCheckboxChecked, checked);
        c.insertText(QString(QChar(checked ? kCheckboxChecked : kCheckboxUnchecked)), cf);
        return true;
    }
    // Task marker sits in the indent gutter left of the text.
    const QTextBlock b = d->findBlock(position);
    if (listKindOf(b.textList()) != TaskList) return false;
    if (x >= lineX - 1 || x < lineX - d->indentWidth() - 8) return false;
    return toggleTask(b.blockNumber());
}

// ── clipboard ─────────────────────────────────────────────────────────────

void EditorController::paste(bool plainOnly)
{
    QTextDocument* d = doc();
    const QMimeData* mime = QGuiApplication::clipboard()->mimeData();
    if (!d || !mime) return;
    QTextCursor c = selectionCursor();
    c.beginEditBlock();
    if (c.hasSelection()) c.removeSelectedText();

    const bool inCode = codeFrameAt(c) != nullptr;
    const int firstBlock = c.blockNumber();
    bool structured = false;  // pasted as blocks: typed-out lists/headings get converted after
    QString text = mime->text();
    text.replace(QStringLiteral("\r\n"), QStringLiteral("\n"));

    if (inCode || plainOnly || c.currentTable()) {
        if (inCode) {
            const QStringList lines = text.split(QLatin1Char('\n'));
            const QTextBlockFormat bf = c.blockFormat();
            for (int i = 0; i < lines.size(); ++i) {
                if (i > 0) c.insertBlock(bf, plainMarks());
                c.insertText(lines[i], plainMarks());
            }
        } else {
            QString flat = text;
            if (c.currentTable()) flat.replace(QLatin1Char('\n'), QChar::LineSeparator);
            QTextCharFormat cf = c.charFormat();
            c.insertText(flat, cf);
        }
    } else if (mime->hasFormat(kNotedMime)) {
        QJsonObject j = doc::parse(QString::fromUtf8(mime->data(kNotedMime)));
        doc::insert(c, j);
    } else if (!text.isEmpty() && doc::looksLikeMarkdown(text)) {
        doc::insert(c, doc::fromMarkdown(text));
        structured = true;
    } else if (mime->hasHtml() && !mime->html().isEmpty()) {
        doc::insert(c, doc::fromHtml(mime->html()));
    } else if (text.contains(QLatin1Char('\n'))) {
        doc::insert(c, doc::fromPlainText(text));
        structured = true;
    } else {
        QTextCharFormat cf = c.charFormat();
        static const QRegularExpression url(QStringLiteral("^https?://\\S+$"));
        if (url.match(text.trimmed()).hasMatch()) {
            cf.setAnchor(true);
            cf.setAnchorHref(text.trimmed());
        }
        c.insertText(text, cf);
    }
    if (structured) formatTypedMarkup(firstBlock, c.blockNumber(), false);
    c.endEditBlock();
    emitCursor(c);
}

void EditorController::copy(const QString& as)
{
    QTextDocument* d = doc();
    QTextCursor c = selectionCursor();
    if (!d || !c.hasSelection()) return;
    const QJsonObject j = doc::saveRange(d, c.selectionStart(), c.selectionEnd());
    auto* mime = new QMimeData;
    QString plain = c.selectedText();
    plain.replace(QChar::ParagraphSeparator, QLatin1Char('\n'));
    plain.replace(QChar::LineSeparator, QLatin1Char('\n'));
    plain.remove(QChar::ObjectReplacementCharacter);
    if (as == u"markdown") {
        mime->setText(doc::toMarkdown(j).trimmed());
    } else if (as == u"plain") {
        mime->setText(plain);
    } else {
        mime->setData(kNotedMime, doc::stringify(j).toUtf8());
        mime->setHtml(doc::toHtmlBody(j));
        mime->setText(plain);
    }
    QGuiApplication::clipboard()->setMimeData(mime);
}

void EditorController::cut()
{
    QTextCursor c = selectionCursor();
    if (!c.hasSelection()) return;
    copy(QStringLiteral("rich"));
    c.removeSelectedText();
    emitCursor(c);
}

// ── find / replace ────────────────────────────────────────────────────────

void EditorController::setFindQuery(const QString& q)
{
    if (q == m_findQuery) return;
    m_findQuery = q;
    rebuildFind();
}

void EditorController::rebuildFind()
{
    QTextDocument* d = doc();
    m_findMatches.clear();
    m_findIndex = -1;
    if (d && !m_findQuery.isEmpty()) {
        QTextCursor c(d);
        while (true) {
            c = d->find(m_findQuery, c);
            if (c.isNull()) break;
            m_findMatches.append(QVariantMap{{"start", c.selectionStart()}, {"length", c.selectionEnd() - c.selectionStart()}});
            if (m_findIndex < 0 && c.selectionStart() >= qMin(m_selStart, m_cursor)) m_findIndex = int(m_findMatches.size()) - 1;
            if (m_findMatches.size() > 5000) break;
        }
        if (m_findIndex < 0 && !m_findMatches.isEmpty()) m_findIndex = 0;
    }
    emit findChanged();
}

int EditorController::findNext(bool backwards)
{
    if (m_findMatches.isEmpty()) return -1;
    const int n = int(m_findMatches.size());
    m_findIndex = m_findIndex < 0 ? 0 : (m_findIndex + (backwards ? n - 1 : 1)) % n;
    const QVariantMap m = m_findMatches.at(m_findIndex).toMap();
    emit findChanged();
    emit requestCursor(m.value("start").toInt() + m.value("length").toInt(), m.value("start").toInt());
    return m.value("start").toInt();
}

void EditorController::replaceCurrent(const QString& with)
{
    if (m_findIndex < 0 || m_findIndex >= m_findMatches.size()) return;
    const QVariantMap m = m_findMatches.at(m_findIndex).toMap();
    QTextCursor c(doc());
    c.setPosition(m.value("start").toInt());
    c.setPosition(m.value("start").toInt() + m.value("length").toInt(), QTextCursor::KeepAnchor);
    c.insertText(with);
    const int idx = m_findIndex;
    rebuildFind();
    if (!m_findMatches.isEmpty()) {
        m_findIndex = qMin(idx, int(m_findMatches.size()) - 1) - 1;
        findNext();
    }
}

int EditorController::replaceAll(const QString& with)
{
    if (m_findMatches.isEmpty()) return 0;
    QTextCursor c(doc());
    c.beginEditBlock();
    const int n = int(m_findMatches.size());
    for (int i = n - 1; i >= 0; --i) {
        const QVariantMap m = m_findMatches.at(i).toMap();
        c.setPosition(m.value("start").toInt());
        c.setPosition(m.value("start").toInt() + m.value("length").toInt(), QTextCursor::KeepAnchor);
        c.insertText(with);
    }
    c.endEditBlock();
    rebuildFind();
    return n;
}
