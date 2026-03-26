# Development Guide

## Prerequisites

- Node.js 20+
- Yarn 4 (corepack)
- Git

## Setup

```bash
git clone <repo>
cd noted

# Enable corepack for Yarn 4
corepack enable

# Install dependencies
yarn install

# Start development (frontend + backend + Electron)
yarn start
```

This runs:
1. Astro dev server on `http://localhost:7241`
2. Backend TypeScript compilation
3. Electron app loading from the dev server

## Scripts

| Script | Description |
|--------|-------------|
| `yarn start` | Full development mode (frontend + backend + Electron) |
| `yarn dev` | Frontend only (Astro dev server) |
| `yarn boot` | Backend build + launch Electron (no frontend dev server) |
| `yarn backend:build` | Compile backend TypeScript |
| `yarn frontend:build` | Build frontend with Astro |
| `yarn cli:build` | Compile CLI TypeScript |
| `yarn pre-build` | Build frontend + backend |
| `yarn build` | Full production build (pre-build + electron-builder) |
| `yarn lint` | Check formatting with Prettier |
| `yarn lint:fix` | Fix formatting |

## Project Structure

### Backend (`src/backend/`)

The Electron main process. Compiled with `tsc` to `src/backend/build/`.

- **`main.ts`** — App lifecycle, window management, global shortcuts
- **`preload.ts`** — IPC bridge via `contextBridge` (CommonJS, not bundled)
- **`constants.ts`** — Path resolution, app config loading
- **`database/`** — SQLite operations, schema migrations
- **`ipc/`** — Handler modules (notes, lists, tags, todos, search, export, sync, lock, CLI, settings)
- **`export/`** — TipTap JSON to HTML/Markdown converters, PDF generation

### Frontend (`src/`)

Astro + Solid.js. Built to `dist/`.

- **`components/`** — UI components organized by feature
- **`stores/`** — Solid.js reactive stores (app state, editor state, settings)
- **`lib/`** — Pure utilities (text cleanup, markdown parsing, date formatting)
- **`theme/`** — PandaCSS config, global styles, component recipes

### CLI (`cli/`)

Standalone Node.js tool with its own `package.json` and `node_modules` (separate from Electron's to avoid native module conflicts).

```bash
cd cli
yarn install      # one-time
yarn cli:build    # from project root
```

### Sync Server (`server/`)

Hocuspocus WebSocket server with its own `package.json`.

```bash
cd server
yarn install
yarn dev          # development
yarn build && yarn start  # production
```

## Adding a New Feature

### New IPC Handler

1. Create `src/backend/ipc/my-handlers.ts`
2. Export a `registerMyHandlers()` function with `ipcMain.handle()` calls
3. Register in `src/backend/ipc/register-all.ts`
4. Expose in `src/backend/preload.ts`
5. Add types in `src/env.d.ts`

### New TipTap Extension

1. Create `src/components/editor/my-extension.ts`
2. Follow the pattern in `codeblock-with-copy.ts` or `details-block.ts`
3. Import and add to the extensions array in `TipTapEditor.tsx`
4. Add styles in `src/theme/global-css.ts` under the `.tiptap` selector
5. Add a toolbar button in `EditorToolbar.tsx`
6. Update export converters if the extension adds new node types

### Database Migration

1. Open `src/backend/database/db.ts`
2. Add a new `if (currentVersion < N)` block
3. Use `PRAGMA table_info` to check before `ALTER TABLE` (idempotent)
4. Call `setSchemaVersion(N)`

## Building for Distribution

```bash
# Build all platforms
yarn build

# Build for a specific platform
yarn pre-build && npx electron-builder --win
yarn pre-build && npx electron-builder --mac
yarn pre-build && npx electron-builder --linux
```

Output goes to `release/`.

## Native Module Rebuilds

`better-sqlite3` is a native module that must be compiled for Electron's Node.js version:

```bash
npx electron-rebuild -f -w better-sqlite3
```

This runs automatically via `postinstall` (`electron-builder install-app-deps`), but may need to be re-run manually if:
- You switch Node.js versions
- You run `npm install` instead of `yarn install`
- The `.node` file gets locked (close Electron first)

The CLI has its own `better-sqlite3` in `cli/node_modules/` compiled for system Node.js — this is intentional.
