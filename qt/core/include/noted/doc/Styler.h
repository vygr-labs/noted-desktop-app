#pragma once

// Derives the visual layer of an editor document from its semantic layer
// (see Schema.h). Pure function of (semantics, palette): run it after load,
// after every edit (on the touched range), and on theme change.
//
// Also "adopts" foreign content: fragments without mark properties (from Qt's
// own paste/drag handling) get marks inferred from their visuals first, so
// they export correctly.

#include <QColor>
#include <QString>

class QTextDocument;
class QTextBlock;
class QTextFrame;

namespace noted::doc {

struct Palette {
    QString bodyFamily = QStringLiteral("IBM Plex Sans");
    QString monoFamily = QStringLiteral("IBM Plex Mono");
    qreal basePx = 15.0;
    qreal lineHeight = 165;  // percent of basePx, as in CSS line-height

    QColor text = QColor("#1c2024");
    QColor muted = QColor("#60646c");
    QColor subtle = QColor("#80838d");
    QColor accent = QColor("#ce2100");
    QColor accentText = QColor("#a41a00");
    QColor link = QColor("#ce2100");
    QColor inlineCodeBg = QColor(0, 0, 0x33, 0x0f);
    QColor codeBlockBg = QColor("#f0f0f3");
    QColor codeBlockText;   // invalid = body text colour
    QColor inlineCodeText;  // invalid = accentText
    QColor checkedText;     // completed task items; invalid = quoteText
    QColor highlightBg = QColor(255, 214, 10, 90);
    QColor quoteText = QColor("#60646c");
    QColor rule = QColor("#e0e1e6");
    QColor tableBorder = QColor("#e0e1e6");
    QColor tableHeaderBg = QColor("#f9f9fb");
    QColor checkbox = QColor("#ce2100");
    QColor findMatchBg = QColor(255, 38, 0, 0x33);
};

class Styler
{
public:
    Styler() = default;
    explicit Styler(const Palette& p)
        : m_p(p)
    {}

    const Palette& palette() const { return m_p; }
    void setPalette(const Palette& p) { m_p = p; }

    // Restyles blocks intersecting [from, to) (whole document by default).
    // Adds no undo step of its own when called inside an edit block.
    void apply(QTextDocument* doc, int from = 0, int to = -1) const;

    // Default document-wide settings (font, margins, indent width).
    void applyDocumentDefaults(QTextDocument* doc) const;

    qreal headingPx(int level) const;

private:
    void styleBlock(QTextDocument* doc, const QTextBlock& b) const;
    void styleFrame(QTextFrame* f) const;

    Palette m_p;
};

}  // namespace noted::doc
