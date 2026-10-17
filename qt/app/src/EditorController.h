#pragma once

// Bridges a QML TextEdit to noted's document model.
//
// QML owns the TextEdit (rendering, caret, selection, IME); this object owns
// everything semantic: loading/saving TipTap JSON, formatting commands, list
// and block behaviour on Enter/Tab/Backspace, markdown shortcuts, paste
// conversion, find, checkbox toggling and autosave. After every edit the
// touched blocks are restyled so visuals always follow the semantic layer.

#include <QJsonObject>
#include <QObject>
#include <QPointer>
#include <QQmlEngine>
#include <QQuickTextDocument>
#include <QTimer>
#include <QVariantList>

#include "noted/NoteStore.h"
#include "noted/doc/Styler.h"
#include "OpenFiles.h"

class QTextBlock;
class QTextCursor;
class QTextDocument;
class QTextFrame;
class QTextList;
class QTextTable;


class EditorController : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QQuickTextDocument* textDocument READ textDocument WRITE setTextDocument NOTIFY textDocumentChanged)
    Q_PROPERTY(noted::NoteStore* store READ store WRITE setStore NOTIFY storeChanged)
    // Where "file:" ids are saved (files opened from disk).
    Q_PROPERTY(OpenFiles* files READ files WRITE setFiles NOTIFY filesChanged)
    Q_PROPERTY(QString noteId READ noteId NOTIFY noteIdChanged)
    Q_PROPERTY(int cursorPosition READ cursorPosition WRITE setCursorPosition NOTIFY cursorPositionChanged)
    Q_PROPERTY(int selectionStart READ selectionStart WRITE setSelectionStart NOTIFY selectionChanged)
    Q_PROPERTY(int selectionEnd READ selectionEnd WRITE setSelectionEnd NOTIFY selectionChanged)
    Q_PROPERTY(QVariantMap palette READ palette WRITE setPalette NOTIFY paletteChanged)

    // Toolbar state at the caret / selection.
    Q_PROPERTY(bool bold READ bold NOTIFY formatChanged)
    Q_PROPERTY(bool italic READ italic NOTIFY formatChanged)
    Q_PROPERTY(bool underline READ underline NOTIFY formatChanged)
    Q_PROPERTY(bool strike READ strike NOTIFY formatChanged)
    Q_PROPERTY(bool code READ code NOTIFY formatChanged)
    Q_PROPERTY(bool highlight READ highlight NOTIFY formatChanged)
    Q_PROPERTY(int headingLevel READ headingLevel NOTIFY formatChanged)
    Q_PROPERTY(int listKind READ listKind NOTIFY formatChanged)  // -1 none, 0 bullet, 1 ordered, 2 task
    Q_PROPERTY(bool inQuote READ inQuote NOTIFY formatChanged)
    Q_PROPERTY(bool inCodeBlock READ inCodeBlock NOTIFY formatChanged)
    Q_PROPERTY(bool inTable READ inTable NOTIFY formatChanged)
    Q_PROPERTY(QString linkHref READ linkHref NOTIFY formatChanged)

    Q_PROPERTY(int wordCount READ wordCount NOTIFY statsChanged)
    Q_PROPERTY(bool dirty READ dirty NOTIFY dirtyChanged)
    Q_PROPERTY(bool empty READ empty NOTIFY statsChanged)
    // Text of the first block when it is a top-level H1 (many notes repeat
    // their title there); "" otherwise.
    Q_PROPERTY(QString leadingHeading READ leadingHeading NOTIFY statsChanged)
    // Level 2 and 3 headings, for "On this page": [{text, level, block}].
    Q_PROPERTY(QVariantList outline READ outline NOTIFY statsChanged)

    // Overlay decorations drawn by QML over the TextEdit: task checkboxes and
    // blockquote bars. [{k: "task"|"quote", block, endBlock, checked}] —
    // changes only when structure changes; `layoutTick` bumps on every
    // relayout so delegates re-query blockGeometry() without being rebuilt.
    Q_PROPERTY(QVariantList decorations READ decorations NOTIFY decorationsChanged)
    Q_PROPERTY(int layoutTick READ layoutTick NOTIFY layoutTickChanged)

    // Find
    Q_PROPERTY(QString findQuery READ findQuery WRITE setFindQuery NOTIFY findChanged)
    Q_PROPERTY(QVariantList findMatches READ findMatches NOTIFY findChanged)  // [{start, length}]
    Q_PROPERTY(int findIndex READ findIndex NOTIFY findChanged)

    // Spelling (when the note has it on): misspelled words get a red wavy
    // underline, drawn on the paragraphs' layouts, never saved.
    Q_PROPERTY(bool spellcheck READ spellcheck WRITE setSpellcheck NOTIFY spellcheckChanged)
    // [{start, length}] of every misspelled word, for the overlay that draws
    // the squiggles (Qt Quick doesn't draw a layout's underline formats).
    Q_PROPERTY(QVariantList spellMarks READ spellMarks NOTIFY spellMarksChanged)

public:
    explicit EditorController(QObject* parent = nullptr);
    ~EditorController() override;

    QQuickTextDocument* textDocument() const { return m_quickDoc; }
    void setTextDocument(QQuickTextDocument* d);
    noted::NoteStore* store() const { return m_store; }
    void setStore(noted::NoteStore* s);
    OpenFiles* files() const { return m_files; }
    void setFiles(OpenFiles* f);
    QString noteId() const { return m_noteId; }
    int cursorPosition() const { return m_cursor; }
    void setCursorPosition(int p);
    int selectionStart() const { return m_selStart; }
    void setSelectionStart(int p);
    int selectionEnd() const { return m_selEnd; }
    void setSelectionEnd(int p);
    QVariantMap palette() const { return m_paletteMap; }
    void setPalette(const QVariantMap& p);

    bool bold() const { return m_fmt.bold; }
    bool italic() const { return m_fmt.italic; }
    bool underline() const { return m_fmt.underline; }
    bool strike() const { return m_fmt.strike; }
    bool code() const { return m_fmt.code; }
    bool highlight() const { return m_fmt.highlight; }
    int headingLevel() const { return m_fmt.heading; }
    int listKind() const { return m_fmt.list; }
    bool inQuote() const { return m_fmt.quote; }
    bool inCodeBlock() const { return m_fmt.codeBlock; }
    bool inTable() const { return m_fmt.table; }
    QString linkHref() const { return m_fmt.href; }
    int wordCount() const { return m_words; }
    bool dirty() const { return m_dirty; }
    bool empty() const { return m_empty; }
    QString leadingHeading() const { return m_leadingHeading; }
    QVariantList outline() const { return m_outline; }
    QString findQuery() const { return m_findQuery; }
    void setFindQuery(const QString& q);
    QVariantList findMatches() const { return m_findMatches; }
    int findIndex() const { return m_findIndex; }
    QVariantList decorations() const { return m_decorations; }
    int layoutTick() const { return m_layoutTick; }

    // {start, end} character positions of a block, for TextEdit's
    // positionToRectangle(). `tick` only exists to make QML re-evaluate.
    Q_INVOKABLE QVariantMap blockGeometry(int blockNumber, int tick = 0) const;
    // The box of the code block holding this block (padding included, margins
    // not), in the TextEdit's coordinates.
    Q_INVOKABLE QRectF codeRect(int blockNumber, int tick = 0) const;
    Q_INVOKABLE bool toggleTask(int blockNumber);
    // Sets ("2026-10-21") or clears ("") a to-do's due date.
    Q_INVOKABLE bool setTaskDue(int blockNumber, const QString& isoDate);

    // ── lifecycle ────────────────────────────────────────────────────
    // Loads a rich note (TipTap JSON). Flushes any pending save first.
    Q_INVOKABLE void load(const QString& noteId, const QString& json);
    // The same note changed elsewhere (sync): show the new text, keeping the
    // caret and selection where they were in it. False when nothing changed.
    Q_INVOKABLE bool refresh(const QString& noteId, const QString& json);
    Q_INVOKABLE void unload();
    Q_INVOKABLE bool flush();                 // save now if dirty; true if a save happened
    Q_INVOKABLE QString json() const;
    Q_INVOKABLE QString plainText() const;
    Q_INVOKABLE QString markdown() const;
    Q_INVOKABLE void restyleAll();

    // ── marks ────────────────────────────────────────────────────────
    Q_INVOKABLE void toggleBold() { toggleMark(Mark::Bold); }
    Q_INVOKABLE void toggleItalic() { toggleMark(Mark::Italic); }
    Q_INVOKABLE void toggleUnderline() { toggleMark(Mark::Underline); }
    Q_INVOKABLE void toggleStrike() { toggleMark(Mark::Strike); }
    Q_INVOKABLE void toggleCode() { toggleMark(Mark::Code); }
    Q_INVOKABLE void toggleHighlight() { toggleMark(Mark::Highlight); }
    Q_INVOKABLE void setLink(const QString& href);  // "" removes
    Q_INVOKABLE QString linkAt(int position) const;
    Q_INVOKABLE void clearFormatting();

    // ── blocks ───────────────────────────────────────────────────────
    Q_INVOKABLE void setHeading(int level);  // 0 = paragraph; same level toggles off
    Q_INVOKABLE void toggleList(int kind);   // 0 bullet, 1 ordered, 2 task
    Q_INVOKABLE void toggleQuote();
    Q_INVOKABLE void toggleCodeBlock();
    Q_INVOKABLE void insertHorizontalRule();
    Q_INVOKABLE void insertTable(int rows = 3, int cols = 3);
    Q_INVOKABLE void tableInsertRow(bool below = true);
    Q_INVOKABLE void tableRemoveRow();
    Q_INVOKABLE void tableInsertColumn(bool after = true);
    Q_INVOKABLE void tableRemoveColumn();
    Q_INVOKABLE void tableDelete();
    Q_INVOKABLE void indent();
    Q_INVOKABLE void outdent();
    Q_INVOKABLE void alignLeft();       // strip leading whitespace (selection or all)
    Q_INVOKABLE void cleanAndFormat();  // typed-out lists/checkboxes/headings → real ones, collapse blank lines
    Q_INVOKABLE void insertDate();

    // ── keys (return true when handled; QML then accepts the event) ──
    Q_INVOKABLE bool handleEnter(bool shift);
    Q_INVOKABLE bool handleBackspace();
    Q_INVOKABLE bool handleTab(bool shift);

    // Toggles a task marker or inline checkbox under a click. `x` is the
    // click position, `lineX` the x of the block's first character.
    Q_INVOKABLE bool clickAt(int position, qreal x, qreal lineX);
    Q_INVOKABLE int blockStart(int position) const;
    Q_INVOKABLE bool isTaskBlock(int position) const;

    // ── clipboard ────────────────────────────────────────────────────
    Q_INVOKABLE void paste(bool plainOnly = false);
    // Copies image files (paths or file:// URLs) into the attachments folder
    // and inserts them as image blocks at `position` (-1: the cursor).
    // Returns how many went in.
    Q_INVOKABLE int insertImageFiles(const QStringList& files, int position = -1);
    Q_INVOKABLE static bool isImageFile(const QString& pathOrUrl);
    Q_INVOKABLE void copy(const QString& as = QStringLiteral("rich"));  // rich | markdown | plain
    Q_INVOKABLE void cut();

    // ── find / replace ───────────────────────────────────────────────
    Q_INVOKABLE int findNext(bool backwards = false);  // returns match start or -1
    bool spellcheck() const { return m_spellcheck; }
    QVariantList spellMarks() const { return m_spellMarks; }
    void setSpellcheck(bool on);
    // The misspelled word at `position`: { start, length, word, suggestions },
    // or empty.
    Q_INVOKABLE QVariantMap misspellingAt(int position) const;
    Q_INVOKABLE void replaceRange(int start, int length, const QString& text);
    Q_INVOKABLE void replaceCurrent(const QString& with);
    Q_INVOKABLE int replaceAll(const QString& with);

signals:
    void textDocumentChanged();
    void storeChanged();
    void filesChanged();
    void noteIdChanged();
    void cursorPositionChanged();
    void selectionChanged();
    void paletteChanged();
    void formatChanged();
    void statsChanged();
    void dirtyChanged();
    void findChanged();
    void spellcheckChanged();
    void spellMarksChanged();
    void decorationsChanged();
    void layoutTickChanged();
    // Ask QML to move the caret / selection after a structural edit.
    void requestCursor(int position, int anchor);
    void saved(const QString& noteId);
    // Live title/preview for the note list while typing.
    void livePreview(const QString& noteId, const QString& preview);

private:
    enum class Mark { Bold, Italic, Underline, Strike, Code, Highlight };
    struct Fmt {
        bool bold = false, italic = false, underline = false, strike = false, code = false, highlight = false;
        int heading = 0, list = -1;
        bool quote = false, codeBlock = false, table = false;
        QString href;
        bool operator==(const Fmt&) const = default;
    };

    QTextDocument* doc() const;
    QTextCursor selectionCursor() const;
    void onContentsChange(int pos, int removed, int added);
    void checkSpelling(int from, int to);  // document positions
    void clearSpelling();
    void collectSpellMarks();
    void restyle(int from, int to);
    void updateFormatState();
    void markDirty();
    void save();
    void recomputeStats();
    void toggleMark(Mark m);
    void applyPendingMarks(int pos, int added);
    bool applyInputRule(int pos);
    void formatTypedMarkup(int firstBlock, int lastBlock, bool collapseBlank);
    void setBlockKind(QTextCursor& c, int kind, int headingLevel = 0);
    void removeFromList(const QTextBlock& b);
    QTextFrame* codeFrameAt(const QTextCursor& c) const;
    void unwrapCodeFrame(QTextFrame* f);
    void wrapInCodeFrame(QTextCursor& sel);
    QTextList* listForDepth(const QTextBlock& near, int kind, int depth) const;
    void addToList(const QTextBlock& b, int kind, int depth);
    void rebuildFind();
    void rebuildDecorations();
    void emitCursor(const QTextCursor& c);

    QPointer<QQuickTextDocument> m_quickDoc;
    QPointer<noted::NoteStore> m_store;
    QPointer<OpenFiles> m_files;
    noted::doc::Styler m_styler;
    QVariantMap m_paletteMap;
    QString m_noteId;
    QString m_json;  // what's loaded, or was last saved
    void build(const QString& noteId, const QString& json);
    int m_cursor = 0, m_selStart = 0, m_selEnd = 0;
    Fmt m_fmt;
    int m_words = 0;
    bool m_empty = true;
    QString m_leadingHeading;
    QVariantList m_outline;
    bool m_dirty = false;
    bool m_loading = false;
    bool m_restyling = false;
    int m_pendingFrom = -1, m_pendingTo = -1;
    QTimer m_restyleTimer;
    bool m_spellcheck = false;
    bool m_spelling = false;          // setting underlines: not an edit
    QTimer m_spellTimer;
    QVariantList m_spellMarks;
    int m_spellFrom = -1, m_spellTo = -1;
    int m_spellHeldBlock = -1;        // the word being typed there wasn't marked yet
    QTimer m_saveTimer;
    QTimer m_statsTimer;
    // Marks toggled with an empty selection apply to the next typed text.
    QHash<int, bool> m_pendingMarks;
    int m_pendingMarksAt = -1;

    QString m_findQuery;
    QVariantList m_findMatches;
    int m_findIndex = -1;

    QVariantList m_decorations;
    int m_layoutTick = 0;
};
