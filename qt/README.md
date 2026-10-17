# noted. — Qt edition

Native Qt 6 / QML rebuild of noted. It reads and writes the **same SQLite
database** as the Electron app (`app/`) and `noted-cli`, so existing notes,
lists, tags, to-dos, settings and lock PINs carry over untouched.

## Layout

```
qt/
├── core/                 noted-core: everything that isn't UI (no Qt Quick)
│   ├── include/noted/
│   │   ├── Database.h    path resolution, schema migrations (v1–v12), external-change watcher
│   │   ├── Sqlite.h      RAII wrapper over the bundled SQLite amalgamation (FTS5 on)
│   │   ├── NoteStore.h   notes / lists / tags / todos / daily / search / lock / settings
│   │   ├── NotesModel.h  note list model (row diffs, never resets)
│   │   ├── DateText.h    "5m ago", due-date labels
│   │   ├── PinHasher.h   scrypt, byte-compatible with Node's crypto.scryptSync
│   │   └── doc/          the document model (see below)
│   └── tests/            unit tests + `roundtrip` tool
└── app/                  noted (executable): QML UI + EditorController + app services
    ├── src/EditorController.*   bridges a QML TextEdit to the document model
    ├── src/AppController.*      export, import, global hotkey, single instance
    └── qml/                     Main, panels/, editor/, todos/, dialogs/, controls/
```

## The document model

Notes are stored as TipTap (ProseMirror) JSON, exactly as the Electron app
writes them. The editor is a native `TextEdit`; `core/src/doc/TipTap.cpp`
converts JSON ⇄ `QTextDocument` losslessly:

- **Semantic layer** — custom `QTextFormat` properties (`doc/Schema.h`) for
  marks and node attributes, plus native heading levels, quote levels, lists
  and tables. This is what gets saved.
- **Visual layer** — fonts, colours, spacing, derived from the semantic
  layer by `doc/Styler` after every edit and on theme change. Never saved.

Code blocks are text frames, task items carry a checked property (the editor
draws the checkbox), inline checkboxes are single atom characters.

`build/roundtrip <db>` pushes every rich note of a database through
load → style → save and reports differences. Against a real 600-note
database: 587 byte-identical; the rest are the known limitations below.

## Building (Windows)

Needs Qt 6.8+ (developed on 6.11.1 MSVC 2022), CMake 3.25+, Ninja, VS 2022.

```powershell
.\scripts\build.ps1            # configure once + build everything
.\scripts\build.ps1 -Test      # build, then run the unit tests
.\build\noted.exe
```

`scripts\shot.ps1 out.png '{"view":"todos"}'` builds and screenshots the app
in a given UI state (see `--state` handling in `qml/Main.qml`).

## Your data while developing

A build running from the source tree **never touches your live notes**. On
first launch it snapshots `%APPDATA%\noted\databases\app.sqlite` (read-only,
via `VACUUM INTO`) to `personal/qt-data/app.sqlite` and works on that copy; a
"DEV COPY" badge shows in the title bar. Use `--real-data` to opt in to the
real database, or `--db <file>` / `NOTED_DB` for any other file. Installed
builds use the real per-user path.

## What's new compared to the Electron app

- Direction 2a from the design handoff: IBM Plex Sans/Mono, warm neutrals,
  no title bar (pane headers drag the window), notes grouped by date with
  checklist progress, filter chips (Has to-dos / Daily / Shared), a compact
  pill toolbar with a block-type picker, a breadcrumb header and a status
  line. Checklist counts are read straight from the stored JSON (no schema
  change) and cached per note.
- A list's open to-dos, gathered from its notes, sit above its notes and can
  be ticked in place (`NoteStore::openTasks` / `setTaskChecked`, a byte-level
  flip of one `"checked"` flag). Today has a month calendar of daily notes.
- A note whose body opens with an H1 repeating its title shows it once; the
  title then follows that heading.

- Window is interactive ~0.3 s after launch; a 47 KB note opens in ~50 ms.
  Memory is ~210 MB private in one process (D3D11 ≈ 80 MB of that) — about
  the same as the Electron app's four processes today; trimming it is open work.
- Command palette runs commands as well as searching (themes, views, lists,
  tags, note actions), and can create a note from the query.
- Markdown shortcuts while typing: `#`, `##`, `###`, `-`, `1.`, `[ ]`, `>`,
  ```` ``` ```` + Enter, `---` + Enter.
- Back/forward through opened notes (Alt+← / Alt+→), Ctrl+↑/↓ to move
  through the list, Ctrl+. for today, arrows to step between daily notes.
- Tags in the sidebar (click to filter); list colours and rename.
- To-dos accept natural due dates ("pay rent friday", "call mom tomorrow").
- Editor text size (Ctrl +/−/0), reading time, per-note toolbar position
  that persists, "Empty trash", copy as Markdown / plain text, paste as plain.
- Pop-out windows are live, read-only views that follow edits.

## Not yet ported

- **Real-time collaboration (Yjs/Hocuspocus).** Shared notes open and edit
  locally, with a banner saying sync is off. Needs a Yjs implementation in
  C++ (or yrs via FFI) plus the Hocuspocus wire protocol.
- **Spellcheck.** Qt has none built in; the plan is Windows' ISpellChecker
  (and NSSpellChecker / Hunspell elsewhere) drawing squiggles as an overlay.
- **Horizontal (tabs) note-list layout** and hidden-section (`detailsBlock`)
  editing — neither exists in the current data; details blocks import as a
  bold summary line followed by their content.
- **Installer / packaging** (windeployqt + Inno Setup, as in crater).

Known document-model limits: blockquotes or tables *inside* list items move
out of the list on save (content kept); ragged markdown tables gain empty
cells; CRLF line endings inside code blocks become LF.
