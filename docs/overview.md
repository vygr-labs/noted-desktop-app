# noted. — Overview

A minimal, distraction-free note-taking app built with Electron, Solid.js, and TipTap.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Electron |
| Frontend framework | Astro + Solid.js |
| Rich text editor | TipTap (ProseMirror) |
| Styling | PandaCSS |
| Database | SQLite (better-sqlite3) |
| Sync server | Hocuspocus (Yjs CRDT) |
| Icons | Lucide |

## Architecture

```
noted/
├── src/
│   ├── backend/           # Electron main process
│   │   ├── main.ts        # App entry point, window management
│   │   ├── preload.ts     # IPC bridge (contextBridge)
│   │   ├── constants.ts   # Paths, app config loader
│   │   ├── database/      # SQLite operations & migrations
│   │   ├── ipc/           # IPC handler modules
│   │   └── export/        # Export converters (HTML, Markdown, PDF)
│   ├── components/        # Solid.js UI components
│   │   ├── editor/        # TipTap editor, toolbar, extensions
│   │   ├── layout/        # App shell, sidebar, note list, editor pane
│   │   ├── settings/      # Settings dialog
│   │   ├── search/        # Command palette, search results
│   │   └── note-list/     # Note cards, context menus
│   ├── stores/            # Solid.js reactive state (app, editor, settings)
│   ├── lib/               # Utilities (text cleanup, date formatting, etc.)
│   └── theme/             # PandaCSS theme, global styles, recipes
├── cli/                   # Standalone CLI tool
├── server/                # Hocuspocus sync server
├── assets/                # Icons, images
├── installer/             # NSIS installer assets
├── app.config.json        # App-level defaults (sync URL, etc.)
└── electron-builder.yml   # Build/packaging configuration
```

## Data Flow

```
User Input
  ↓
Solid.js Components (renderer process)
  ↓
IPC via preload.ts (contextBridge)
  ↓
Electron Main Process (IPC handlers)
  ↓
SQLite Database (better-sqlite3)
```

## Database

SQLite with WAL mode. Located at:
- **Windows:** `%APPDATA%/noted/databases/app.sqlite`
- **macOS:** `~/Library/Application Support/noted/databases/app.sqlite`
- **Linux:** `~/.config/noted/databases/app.sqlite`

Schema migrations run automatically on startup. See `src/backend/database/db.ts`.

## IPC Pattern

All communication between renderer and main process uses Electron's `ipcRenderer.invoke()` / `ipcMain.handle()` pattern:

```
Renderer                    Main Process
────────                    ────────────
electronAPI.fetchAllNotes()  →  ipcMain.handle('notes:fetch-all')
                             ←  returns Note[]
```

The full API is typed in `src/env.d.ts` and exposed via `src/backend/preload.ts`.
