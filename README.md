# AstroJS + Electron Template

A template for building desktop applications with **Astro**, **SolidJS**, **Electron**, **Park UI** (Ark UI + Panda CSS), and **SQLite**.

## Tech Stack

- **[Astro](https://astro.build/)** — Static site generator for the frontend
- **[SolidJS](https://www.solidjs.com/)** — Reactive UI framework
- **[Electron](https://www.electronjs.org/)** — Desktop app shell
- **[Park UI](https://park-ui.com/)** — Component library (Ark UI + Panda CSS)
- **[Panda CSS](https://panda-css.com/)** — Type-safe CSS-in-JS
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — SQLite database

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

## Getting Started

```bash
# Clone the template
git clone https://github.com/your-username/astrojs-electron-template.git
cd astrojs-electron-template

# Install dependencies
npm install

# Generate Panda CSS styled-system
npx panda codegen

# Start the app (Astro dev server + Electron)
npm start
```

## Project Structure

```
├── assets/                  # Electron build resources (icons)
├── public/                  # Static web assets
├── src/
│   ├── assets/              # Dev-time assets & global CSS
│   ├── backend/             # Electron main process
│   │   ├── database/        # SQLite database & operations
│   │   ├── main.ts          # Electron entry point
│   │   ├── preload.ts       # IPC bridge (contextBridge)
│   │   └── constants.ts     # Path constants
│   ├── components/          # SolidJS components
│   │   ├── ui/              # Park UI components
│   │   └── Demo.tsx         # Example component
│   ├── layouts/             # Astro layouts
│   ├── pages/               # Astro pages (file-based routing)
│   └── theme/               # Panda CSS theme configuration
├── styled-system/           # Generated Panda CSS (gitignored)
├── astro.config.mjs
├── panda.config.ts
├── electron-builder.yml
└── package.json
```

## Customization

### Add a new page

Create a `.astro` file in `src/pages/`. Astro uses file-based routing.

### Add a SolidJS component

Create a `.tsx` file in `src/components/` and use it in an Astro page with `client:load`:

```astro
---
import MyComponent from '../components/MyComponent.tsx';
---
<MyComponent client:load />
```

### Add an IPC handler

1. Add the handler in `src/backend/main.ts`:
   ```ts
   ipcMain.handle('my-channel', (_, arg) => { /* ... */ })
   ```
2. Expose it in `src/backend/preload.ts`:
   ```ts
   myMethod: (arg) => ipcRenderer.invoke('my-channel', arg),
   ```
3. Add the type in `src/env.d.ts` and call it from the renderer:
   ```ts
   window.electronAPI.myMethod(arg)
   ```

### Add a database table

1. Add the schema in `src/backend/database/db.ts`
2. Create operations in a new file under `src/backend/database/`
3. Wire up IPC handlers in `main.ts` and `preload.ts`

## Scripts

| Command | Action |
|:--------|:-------|
| `npm start` | Start dev server + Electron |
| `npm run dev` | Astro dev server only |
| `npm run build` | Build for production (Astro + Electron) |
| `npm run backend:build` | Compile backend TypeScript |
| `npm run lint` | Check formatting with Prettier |
| `npm run lint:fix` | Fix formatting |

## Building & Packaging

```bash
npm run build
```

This builds the Astro frontend, compiles the backend TypeScript, and packages the app with electron-builder. Output goes to the `release/` directory.

Build targets are configured in `electron-builder.yml`:
- **Windows**: NSIS installer
- **Linux**: AppImage
- **macOS**: DMG
