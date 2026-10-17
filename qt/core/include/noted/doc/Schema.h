#pragma once

// How a TipTap/ProseMirror document is represented inside a QTextDocument.
//
// The editor's QTextDocument carries TWO layers of formatting:
//
//   semantic  — custom QTextFormat properties below (plus a few native ones:
//               headingLevel, BlockQuoteLevel, QTextList membership, block
//               markers, anchorHref). These are the source of truth and are
//               what TipTapExport reads.
//   visual    — fonts, sizes, colours, margins. Always DERIVED from the
//               semantic layer by DocumentStyler, never read back.
//
// Keeping marks in dedicated properties (instead of reading QFont::bold())
// is what makes the round trip exact: a heading is visually bold, but its
// text has no `bold` mark, and a theme change can restyle everything without
// touching content.

#include <QTextFormat>

namespace noted::doc {

enum Property : int {
    // ── char (marks) ────────────────────────────────────────────────
    MarkBold = QTextFormat::UserProperty + 1,
    MarkItalic,
    MarkUnderline,
    MarkStrike,
    MarkCode,
    MarkHighlight,
    MarkHighlightAttrs,   // QString JSON of highlight attrs, when present
    MarkLinkAttrs,        // QString JSON of the full link attrs object
    InlineCheckbox,       // bool: this character is an inlineCheckbox atom
    InlineCheckboxChecked,
    // Search/find decorations — never exported.
    FindMatch,
    // On an image's character (QTextImageFormat): the node's src as stored,
    // e.g. "attachment:3f…c1.png"; the format's name is where it's loaded from.
    ImageSrc,

    // ── block ───────────────────────────────────────────────────────
    // Headings use the native headingLevel, blockquotes the native
    // QTextFormat::BlockQuoteLevel, horizontal rules the native
    // BlockTrailingHorizontalRulerWidth — so Qt's own markdown/HTML importers
    // produce documents this layer already understands.
    BlockKind = QTextFormat::UserProperty + 100,  // BlockKindValue
    BlockNodeAttrs,       // QString JSON of the leaf node's attrs (verbatim)
    BlockListContinuation,// int: list depth of the item this paragraph continues (0 = none)
    BlockItemAttrs,       // QString JSON of the listItem/taskItem attrs (verbatim)
    BlockScaffold,        // bool: structural filler block (around tables/frames); dropped on export if empty
    // bool: taskItem checked state. Task items carry NO native block marker,
    // so Qt draws nothing and the editor overlays its own checkbox; a native
    // marker (from Qt's markdown importer) is still read as a fallback.
    BlockTaskChecked,

    // ── frame (QTextFrameFormat) — code blocks are frames ───────────
    FrameKind = QTextFormat::UserProperty + 150,  // FrameKindValue
    FrameNodeAttrs,       // QString JSON of the codeBlock attrs (verbatim)

    // ── list (QTextListFormat) ──────────────────────────────────────
    ListKind = QTextFormat::UserProperty + 200,   // ListKindValue
    ListNodeAttrs,        // QString JSON of the list node's attrs (verbatim)

    // ── table cell ──────────────────────────────────────────────────
    CellIsHeader = QTextFormat::UserProperty + 300,
    CellNodeAttrs,        // QString JSON of tableCell/tableHeader attrs
    TableNodeAttrs,
    RowNodeAttrs,
};

enum BlockKindValue : int {
    Paragraph = 0,
    Heading = 1,
    HorizontalRule = 3,
    ImageBlock = 4,   // a TipTap `image` node: one image character, attrs in BlockNodeAttrs
};

enum FrameKindValue : int {
    PlainFrame = 0,
    CodeBlockFrame = 1,
};

enum ListKindValue : int {
    BulletList = 0,
    OrderedList = 1,
    TaskList = 2,
};

inline bool taskChecked(const QTextBlockFormat& bf)
{
    return bf.hasProperty(BlockTaskChecked) ? bf.boolProperty(BlockTaskChecked)
                                            : bf.marker() == QTextBlockFormat::MarkerType::Checked;
}

inline void setTaskChecked(QTextBlockFormat& bf, bool checked)
{
    bf.setProperty(BlockTaskChecked, checked);
    bf.setMarker(QTextBlockFormat::MarkerType::NoMarker);
}

inline void clearTask(QTextBlockFormat& bf)
{
    bf.clearProperty(BlockTaskChecked);
    bf.setMarker(QTextBlockFormat::MarkerType::NoMarker);
}

// Inline atoms are stored as a single character carrying InlineCheckbox.
inline constexpr char16_t kCheckboxUnchecked = u'☐';  // ☐
inline constexpr char16_t kCheckboxChecked = u'☑';    // ☑

}  // namespace noted::doc
