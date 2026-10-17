#include "noted/doc/Styler.h"

#include <QFont>
#include <QTextBlock>
#include <QTextCursor>
#include <QTextDocument>
#include <QTextFrame>
#include <QTextList>
#include <QTextTable>

#include "noted/doc/Schema.h"

namespace noted::doc {

namespace {

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

// Infers mark properties for a fragment that arrived without them.
void adoptMarks(QTextCharFormat& cf, bool inHeading, bool inCode)
{
    const bool code = !inCode && looksMonospace(cf);
    cf.setProperty(MarkCode, code);
    cf.setProperty(MarkBold, !inHeading && cf.fontWeight() >= QFont::DemiBold);
    cf.setProperty(MarkItalic, cf.fontItalic());
    cf.setProperty(MarkUnderline, cf.fontUnderline() && !cf.isAnchor());
    cf.setProperty(MarkStrike, cf.fontStrikeOut());
    cf.setProperty(MarkHighlight, !code && cf.background().style() != Qt::NoBrush && cf.background().color().alpha() > 0);
}

QTextFrame* frameOf(const QTextBlock& b)
{
    return QTextCursor(b).currentFrame();
}

bool inCodeFrame(const QTextBlock& b)
{
    const QTextFrame* f = frameOf(b);
    return f && f->frameFormat().intProperty(FrameKind) == CodeBlockFrame;
}

}  // namespace

qreal Styler::headingPx(int level) const
{
    switch (level) {
    case 1:  return m_p.basePx * 1.75;
    case 2:  return m_p.basePx * 1.4;
    case 3:  return m_p.basePx * 1.15;
    default: return m_p.basePx * 1.05;
    }
}

void Styler::applyDocumentDefaults(QTextDocument* doc) const
{
    QFont f(m_p.bodyFamily);
    f.setPixelSize(qRound(m_p.basePx));
    f.setHintingPreference(QFont::PreferNoHinting);
    doc->setDefaultFont(f);
    doc->setIndentWidth(m_p.basePx * 1.6);
    doc->setDocumentMargin(2);
}

void Styler::apply(QTextDocument* doc, int from, int to) const
{
    QTextBlock b = doc->findBlock(qMax(0, from));
    const QTextBlock last = to < 0 ? doc->lastBlock() : doc->findBlock(qMax(from, to - 1));
    if (!b.isValid()) return;
    const int stop = last.isValid() ? last.blockNumber() : doc->blockCount() - 1;
    QTextFrame* lastFrame = nullptr;
    for (; b.isValid() && b.blockNumber() <= stop; b = b.next()) {
        QTextFrame* f = frameOf(b);
        if (f != lastFrame && f != doc->rootFrame()) {
            styleFrame(f);
            lastFrame = f;
        }
        styleBlock(doc, b);
    }
}

void Styler::styleFrame(QTextFrame* f) const
{
    if (!f) return;
    if (auto* t = qobject_cast<QTextTable*>(f)) {
        QTextTableFormat tf = t->format();
        QTextTableFormat want = tf;
        want.setBorder(1);
        want.setBorderBrush(m_p.tableBorder);
        want.setBorderStyle(QTextFrameFormat::BorderStyle_Solid);
        want.setBorderCollapse(true);
        want.setCellPadding(8);
        want.setCellSpacing(0);
        want.setTopMargin(10);
        want.setBottomMargin(10);
        want.setWidth(QTextLength(QTextLength::PercentageLength, 100));
        if (!(want == tf)) t->setFormat(want);
        for (int r = 0; r < t->rows(); ++r) {
            for (int c = 0; c < t->columns(); ++c) {
                QTextTableCell cell = t->cellAt(r, c);
                if (cell.row() != r || cell.column() != c) continue;
                QTextCharFormat cf = cell.format();
                QTextCharFormat wantCell = cf;
                if (cf.boolProperty(CellIsHeader)) wantCell.setBackground(m_p.tableHeaderBg);
                else wantCell.clearBackground();
                if (!(wantCell == cf)) cell.setFormat(wantCell);
            }
        }
        return;
    }
    if (f->frameFormat().intProperty(FrameKind) == CodeBlockFrame) {
        QTextFrameFormat ff = f->frameFormat();
        QTextFrameFormat want = ff;
        want.setBackground(m_p.codeBlockBg);
        want.setPadding(14);
        want.setLeftMargin(0);
        want.setTopMargin(10);
        want.setBottomMargin(10);
        want.setBorder(0);
        if (!(want == ff)) f->setFrameFormat(want);
    }
}

void Styler::styleBlock(QTextDocument* doc, const QTextBlock& b) const
{
    QTextCursor cur(b);
    QTextBlockFormat bf = b.blockFormat();
    QTextBlockFormat want = bf;

    // ── adopt semantics for foreign blocks ───────────────────────────
    if (!bf.hasProperty(BlockKind)) {
        if (bf.headingLevel() > 0) want.setProperty(BlockKind, Heading);
        else if (bf.hasProperty(QTextFormat::BlockTrailingHorizontalRulerWidth)) want.setProperty(BlockKind, HorizontalRule);
        else want.setProperty(BlockKind, Paragraph);
    }
    QTextList* list = b.textList();
    if (list && !list->format().hasProperty(ListKind)) {
        QTextListFormat lf = list->format();
        const bool task = bf.marker() != QTextBlockFormat::MarkerType::NoMarker || bf.hasProperty(BlockTaskChecked);
        const bool ordered = lf.style() == QTextListFormat::ListDecimal || lf.style() == QTextListFormat::ListLowerAlpha
                             || lf.style() == QTextListFormat::ListUpperAlpha
                             || lf.style() == QTextListFormat::ListLowerRoman
                             || lf.style() == QTextListFormat::ListUpperRoman;
        lf.setProperty(ListKind, task ? TaskList : ordered ? OrderedList : BulletList);
        list->setFormat(lf);
    }

    const int kind = want.intProperty(BlockKind);
    const int headingLevel = kind == Heading ? qMax(1, bf.headingLevel()) : 0;
    if (kind != Heading && bf.headingLevel() > 0) want.setHeadingLevel(0);
    const bool code = inCodeFrame(b);
    const bool inTable = cur.currentTable() != nullptr;
    const int quote = bf.intProperty(QTextFormat::BlockQuoteLevel);
    const bool isTask = list && list->format().intProperty(ListKind) == TaskList;
    const bool checked = isTask && taskChecked(bf);
    if (isTask) {
        // Native markers (foreign content) become the property; Qt then draws
        // nothing and the editor overlays its own checkbox.
        if (!bf.hasProperty(BlockTaskChecked) || bf.marker() != QTextBlockFormat::MarkerType::NoMarker)
            setTaskChecked(want, checked);
        if (list->format().style() != QTextListFormat::ListStyleUndefined) {
            QTextListFormat lf = list->format();
            lf.setStyle(QTextListFormat::ListStyleUndefined);
            list->setFormat(lf);
        }
    } else if (bf.hasProperty(BlockTaskChecked) || bf.marker() != QTextBlockFormat::MarkerType::NoMarker) {
        clearTask(want);
    }
    bool headerCell = false;
    if (QTextTable* t = cur.currentTable()) headerCell = t->cellAt(cur).format().boolProperty(CellIsHeader);

    // ── block visuals ────────────────────────────────────────────────
    const QTextBlock prev = b.previous();
    const bool firstInFrame = !prev.isValid() || frameOf(prev) != frameOf(b);
    const bool prevSameList = list && prev.isValid() && prev.textList() == list;
    const bool prevInSameItem = prev.isValid() && (prev.textList() || prev.blockFormat().intProperty(BlockListContinuation) > 0)
                                && (list || bf.intProperty(BlockListContinuation) > 0);
    // Vertical rhythm: space is what groups the text. Paragraphs get a clear
    // break. A list starts with extra room and ends with little, so a
    // checklist item and the lines under it read as one entry. A heading gets
    // a lot above and little below, so it belongs to what follows.
    const QTextBlockFormat pf = prev.isValid() ? prev.blockFormat() : QTextBlockFormat();
    const bool prevIsList = prev.isValid() && (prev.textList() || pf.intProperty(BlockListContinuation) > 0);
    const bool prevIsHeading = prev.isValid() && pf.intProperty(BlockKind) == Heading;
    const bool isList = list || bf.intProperty(BlockListContinuation) > 0;
    qreal top = m_p.basePx * 0.75;
    if (isList && !prevIsList) top = m_p.basePx * 1.3;
    else if (!isList && prevIsList) top = m_p.basePx * 0.5;
    if (prevIsHeading) top = m_p.basePx * 0.45;
    if (firstInFrame || code) top = 0;
    else if (prevSameList || prevInSameItem || (isList && prevIsList)) top = m_p.basePx * 0.3;
    if (headingLevel > 0 && !firstInFrame)
        top = m_p.basePx * (headingLevel == 1 ? 2.0 : headingLevel == 2 ? 1.75 : 1.4);
    if (inTable) top = firstInFrame ? 0 : m_p.basePx * 0.3;

    want.setTopMargin(top);
    want.setBottomMargin(0);
    // Exact pixel line boxes, like CSS line-height. Proportional heights in Qt
    // scale the font's own (tall, on Windows) line spacing, which compounds.
    const qreal linePx = code ? m_p.basePx * 0.87 * 1.55
                       : headingLevel > 0 ? headingPx(headingLevel) * 1.25
                                          : m_p.basePx * m_p.lineHeight / 100.0;
    want.setLineHeight(qRound(linePx), QTextBlockFormat::FixedHeight);
    want.setLeftMargin(quote > 0 ? quote * m_p.basePx * 1.2 : 0);
    const int cont = bf.intProperty(BlockListContinuation);
    want.setIndent(!list && cont > 0 ? cont : 0);
    want.setNonBreakableLines(false);
    if (kind == HorizontalRule) {
        want.setProperty(QTextFormat::BlockTrailingHorizontalRulerWidth, QTextLength(QTextLength::PercentageLength, 100));
        want.setTopMargin(firstInFrame ? 0 : m_p.basePx * 0.9);
        want.setBottomMargin(m_p.basePx * 0.4);
    } else {
        want.clearProperty(QTextFormat::BlockTrailingHorizontalRulerWidth);
    }
    if (!(want == bf)) cur.setBlockFormat(want);

    // ── char visuals ─────────────────────────────────────────────────
    auto visual = [&](QTextCharFormat cf) {
        if (!cf.hasProperty(MarkBold)) adoptMarks(cf, headingLevel > 0, code);
        const bool mCode = !code && cf.boolProperty(MarkCode);
        const bool isBox = cf.boolProperty(InlineCheckbox);
        const bool link = cf.isAnchor() && !cf.anchorHref().isEmpty();

        cf.setFontFamilies(QStringList{(mCode || code) ? m_p.monoFamily : m_p.bodyFamily});
        cf.setFontFixedPitch(mCode || code);
        qreal px = headingLevel > 0 ? headingPx(headingLevel) : m_p.basePx;
        if (mCode || code) px = m_p.basePx * 0.87;
        if (isBox) px = m_p.basePx * 1.15;
        cf.setProperty(QTextFormat::FontPixelSize, qRound(px));
        cf.clearProperty(QTextFormat::FontPointSize);

        int weight = QFont::Normal;
        if (headingLevel == 1) weight = QFont::Bold;
        else if (headingLevel == 2) weight = 650;
        else if (headingLevel >= 3) weight = QFont::DemiBold;
        if (cf.boolProperty(MarkBold)) weight = QFont::Bold;
        if (headerCell && weight < QFont::DemiBold) weight = QFont::DemiBold;
        cf.setFontWeight(weight);

        cf.setFontItalic(cf.boolProperty(MarkItalic) || quote > 0);
        cf.setFontUnderline(cf.boolProperty(MarkUnderline) || link);
        cf.setFontStrikeOut(cf.boolProperty(MarkStrike) || checked);
        if (headingLevel > 0) {
            cf.setFontLetterSpacingType(QFont::AbsoluteSpacing);
            cf.setFontLetterSpacing(headingLevel == 1 ? -0.5 : -0.25);
        } else {
            cf.clearProperty(QTextFormat::FontLetterSpacing);
            cf.clearProperty(QTextFormat::FontLetterSpacingType);
        }

        if (isBox) cf.setForeground(m_p.checkbox);
        else if (link) cf.setForeground(m_p.link);
        else if (mCode) cf.setForeground(m_p.inlineCodeText.isValid() ? m_p.inlineCodeText : m_p.accentText);
        else if (code && m_p.codeBlockText.isValid()) cf.setForeground(m_p.codeBlockText);
        else if (checked) cf.setForeground(m_p.checkedText.isValid() ? m_p.checkedText : m_p.quoteText);
        else if (quote > 0) cf.setForeground(m_p.quoteText);
        else cf.clearForeground();

        if (cf.boolProperty(FindMatch)) cf.setBackground(m_p.findMatchBg);
        else if (cf.boolProperty(MarkHighlight) && !code) cf.setBackground(m_p.highlightBg);
        else if (mCode) cf.setBackground(m_p.inlineCodeBg);
        else cf.clearBackground();
        return cf;
    };

    const QTextCharFormat bcf = b.charFormat();
    const QTextCharFormat wantBcf = visual(bcf);
    if (!(wantBcf == bcf)) cur.setBlockCharFormat(wantBcf);

    // Collect first: setCharFormat can merge fragments under a live iterator.
    struct Change {
        int pos, len;
        QTextCharFormat fmt;
    };
    QList<Change> changes;
    for (auto it = b.begin(); !it.atEnd(); ++it) {
        const QTextFragment frag = it.fragment();
        if (!frag.isValid()) continue;
        const QTextCharFormat cf = frag.charFormat();
        QTextCharFormat w = visual(cf);
        if (!(w == cf)) changes.append({frag.position(), frag.length(), std::move(w)});
    }
    for (const Change& c : changes) {
        QTextCursor fc(doc);
        fc.setPosition(c.pos);
        fc.setPosition(c.pos + c.len, QTextCursor::KeepAnchor);
        fc.setCharFormat(c.fmt);
    }
}

}  // namespace noted::doc
