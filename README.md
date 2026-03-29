# noted.

A minimal, distraction-free note-taking app for desktop. Built by [Voyager Technologies](https://github.com/vygr-labs).

## Features

- **Rich text editing** — Headings, bold, italic, underline, strikethrough, highlight, code blocks, blockquotes, and task lists (powered by TipTap)
- **Plain text mode** — Switch any note to a simple plain text editor
- **Daily notes** — Auto-organized by date with a dedicated "Today" view
- **Todos** — Built-in task management with dedicated todo lists and completion tracking
- **Tags** — Tag notes for flexible organization
- **Custom lists** — Organize notes into lists with custom colors and icons
- **Quick capture** — Global shortcut (`Ctrl+Alt+N`) to jot down a note from anywhere
- **Popout windows** — Pop out notes or todos into separate pinnable windows
- **Focus mode** — Hide the sidebar and note list for distraction-free writing
- **Full-text search** — Search across all notes instantly, plus in-note search (`Ctrl+F`)
- **Themes** — Light, Dark, Warm, and Slate themes with system preference support
- **Per-note spellcheck** — Toggle spellcheck on or off for individual notes
- **Local storage** — All data stored locally in SQLite. Your data stays on your machine.
- **Keyboard shortcuts** — `Ctrl+B` toggle sidebar, `Ctrl+[` toggle note list, `Ctrl+Shift+F` command palette, and more

## Download

The Windows installer is available on the [Releases](../../releases) page. macOS and Linux builds can be built from source (see below).

## Tech Stack

- [Electron](https://www.electronjs.org/) — Desktop application framework
- [Astro](https://astro.build/) — Frontend build tool
- [Solid.js](https://www.solidjs.com/) — Reactive UI framework
- [TipTap](https://tiptap.dev/) — Rich text editor
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Local database
- [Panda CSS](https://panda-css.com/) — Styling

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Yarn](https://yarnpkg.com/) 4

### Install dependencies

```bash
yarn install
```

### Development

```bash
yarn start
```

This starts the Astro dev server and launches Electron in development mode.

### Building

```bash
yarn build
```

The installer will be output to the `release/` directory.

Build targets are configured in `electron-builder.yml`:
- **Windows** — NSIS installer
- **Linux** — AppImage
- **macOS** — DMG

## Scripts

| Command | Action |
|:--------|:-------|
| `yarn start` | Start dev server + Electron |
| `yarn dev` | Astro dev server only |
| `yarn build` | Build for production (Astro + Electron) |
| `yarn build:fast` | Build without code signing |
| `yarn backend:build` | Compile backend TypeScript |
| `yarn lint` | Check formatting with Prettier |
| `yarn lint:fix` | Fix formatting |

## Project Structure

```
src/
  backend/           Electron main process
    database/        SQLite schema, migrations, and operations
    ipc/             IPC handler registration
    main.ts          Electron entry point
    preload.ts       IPC bridge (contextBridge)
    constants.ts     Path constants
  components/
    editor/          TipTap editor, toolbar, note header, tags
    layout/          App shell, sidebar, editor pane, titlebar
    popout/          Popout window views
    settings/        Settings dialog
  stores/            App and editor state management
  lib/               Utility functions
  pages/             Astro pages (index, quick-capture, popout)
  theme/             Panda CSS theme and recipes
assets/              App icons and resources
installer/           NSIS installer customization
```

## License

CC-BY-NC-4.0
