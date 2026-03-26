# Configuration

## App Config (`app.config.json`)

Located at the project root. Bundled with the app via `extraResources` in `electron-builder.yml`.

```json
{
  "syncServerUrl": "wss://noted-sync.fly.dev",
  "syncAuthToken": ""
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `syncServerUrl` | Default WebSocket URL for the sync server | `"wss://noted-sync.fly.dev"` |
| `syncAuthToken` | Default global auth token (must match server's `authSecret`) | `""` |

These values are used as defaults when the user hasn't configured their own in Settings. Users can override both in **Settings > Collaboration**.

The config is read by the main process at startup (`src/backend/constants.ts`) and exposed to the renderer via the `getAppConfig()` IPC call.

## Server Config (`server/config.json`)

Located in the `server/` directory. Gitignored — use `config.example.json` as a template.

```json
{
  "port": 9090,
  "authSecret": "your-secret-here",
  "maxConnections": 100,
  "quiet": false
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `port` | Server listen port | `9090` |
| `authSecret` | Global auth secret (clients must send this to connect) | `""` (open) |
| `maxConnections` | Maximum concurrent connections | `100` |
| `quiet` | Suppress console output | `false` |

Environment variables override config file values:
- `PORT` overrides `port`
- `AUTH_SECRET` overrides `authSecret`
- `DATA_DIR` overrides the SQLite storage path (default: `server/data/`)

## Electron Builder (`electron-builder.yml`)

Build and packaging configuration:

```yaml
appId: com.voyagertech.noted
productName: noted

win:
  target: nsis
linux:
  target: AppImage
mac:
  target: dmg

files: ['src/backend/build/**/*', 'dist/**/*']
extraResources: ['./assets/**', './cli/build/**', './app.config.json']
directories:
  output: 'release'
```

Key points:
- `extraResources` bundles the CLI and app config with the installer
- Output goes to `release/` directory
- Artifact naming: `noted-{os}-{arch}.{ext}`

## User Settings (Database)

User-configurable settings stored in the `settings` table (key-value):

| Key | Description | Default |
|-----|-------------|---------|
| `appTheme` | Theme: light, dark, warm, slate, system | `system` |
| `defaultNoteType` | New note type: rich, plain | `rich` |
| `popoutSkipTaskbar` | Hide popout from Alt+Tab | `false` |
| `syncServerUrl` | User's sync server URL override | (from app config) |
| `syncToken` | User's auth token override | (from app config) |
| `lock_pin_hash` | Hashed lock PIN (scrypt) | none |
| `lock_pin_salt` | Salt for PIN hash | none |
