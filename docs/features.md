# Features

## Rich Text Editor

Full-featured TipTap editor with a configurable toolbar (top, right, bottom, or left position).

**Formatting:** Bold, Italic, Underline, Strikethrough, Highlight

**Structure:** Headings (H1-H3), Bullet lists, Ordered lists, Task lists, Blockquotes, Code blocks, Horizontal rules

**Tables:** Insert 3x3 tables. Contextual row/column controls appear when the cursor is inside a table (+Row, -Row, +Col, -Col, delete table).

**Hidden Sections:** Collapsible content blocks with an editable title. Double-click the title to rename. Click the chevron to toggle.

**Inline Checkboxes:** Interactive checkboxes in table cells. Pasting markdown with `[ ]` or `[x]` in tables renders clickable checkboxes.

**Align:** Strips leading whitespace from text. Selection-aware — aligns only selected text if there's a selection, otherwise the entire note.

**Clean & Format:** Converts plain-text list patterns (`- item`, `1. item`, `- [ ] task`) into proper rich text lists. Collapses empty paragraphs and trims whitespace.

**Markdown Paste:** Pasting markdown auto-converts headings, bold, italic, links, code, blockquotes, lists, tables, and horizontal rules into rich text.

## Note Types

- **Rich text** — TipTap editor with full formatting toolbar
- **Plain text** — Simple textarea, no formatting

Plain text notes show a "Convert to rich text" button (Type icon) in the controls bar.

## Note Organization

- **Lists** — Create custom lists to group notes. Notes can belong to one list.
- **Tags** — Assign multiple colored tags to notes. Tags appear as dots on note cards.
- **Pinning** — Pin important notes to the top of any list view.
- **Daily Notes** — Auto-generated notes for each day. Accessed via the "Today" view.

## Search

- **In-note search** (`Ctrl+F`) — Find text within the current note with match highlighting and navigation.
- **Find & Replace** (`Ctrl+H`) — Replace matches individually or all at once.
- **Global search** (`Ctrl+Shift+F`) — Full-text search across all notes using SQLite FTS5.

## Export

### Single Note Export
Click the download icon in the editor controls and choose a format:
- **PDF** — Styled document generated via Electron's printToPDF
- **Word (.doc)** — Word-compatible HTML with Office XML namespaces
- **HTML** — Standalone HTML file with embedded styles
- **Markdown** — Standard markdown
- **Plain Text** — Raw text content

### Bulk Export
Click the download icon in the sidebar toolbar:
- **JSON** — All data (notes, lists, tags, todos, settings)
- **SQL** — INSERT statements for all tables
- **ZIP** — All notes as individual markdown files

## Note Locking

Protect sensitive notes with a PIN.

1. Set a PIN in **Settings > Security > Lock PIN**
2. Click the lock icon on any note to lock it
3. Locked notes show a blurred overlay — enter your PIN to unlock
4. Unlocked notes stay accessible for the current session
5. On macOS, Touch ID can be used instead of PIN

Locked notes show a lock icon and "Locked" preview in the note list.

## Real-Time Collaboration

Share notes for real-time co-editing via a Hocuspocus sync server.

1. Click the share icon on a note
2. Click **Share & copy code** — a share code is generated and copied to clipboard
3. The other user clicks share > **Join shared note** and pastes the code
4. Both users see real-time edits

Share codes use per-document secrets (`syncId.docSecret`) for security. See [sync.md](sync.md) for details.

## Quick Capture

`Ctrl+Shift+N` opens a quick capture window — type a note and it's saved instantly.

## Popout Windows

Detach views into floating windows. Popout windows can be pinned (always on top) and optionally hidden from Alt+Tab.

## Themes

Five theme options in **Settings > Appearance**:
- Light, Warm, Slate, Dark, System (follows OS)
