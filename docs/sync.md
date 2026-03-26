# Real-Time Sync & Collaboration

Noted uses [Hocuspocus](https://hocuspocus.dev) (a Yjs WebSocket server) for real-time collaboration. The TipTap editor integrates with Yjs via `@tiptap/extension-collaboration`.

## Architecture

```
User A (noted app)  ──┐
                      ├──  WebSocket (wss://)  ──►  Hocuspocus Server
User B (noted app)  ──┘                              │
                                                  SQLite (persists Yjs docs)
```

Each shared note is a Yjs document identified by its `sync_id`. Changes are synced in real-time via CRDTs — no conflicts, works offline.

## Security Model

### Two-Layer Authentication

1. **Global server secret** (`authSecret` in server config) — blocks unauthorized connections to the server entirely. All clients must know this secret.

2. **Per-document tokens** — each shared note has a unique `sync_secret` (32-char hex). The share code format is `syncId.docSecret`. Both parts are required.

**Token flow:**
```
Share code: "abc-123.9f8e7d6c5b4a..."
                │          │
                │          └── docSecret (per-document, random)
                └── syncId (UUID, identifies the Yjs document)
```

**Server validation:**
- First connection to a new document registers the token hash as "owner"
- Subsequent connections must provide a token that matches a registered hash
- Tokens are stored as SHA-256 hashes — the server never sees the raw secret

**Wire format:**
- If global auth is set: token = `globalSecret:docSecret`
- If no global auth: token = `docSecret`

## Server Setup

### Configuration

`server/config.json`:
```json
{
  "port": 9090,
  "authSecret": "your-global-secret",
  "maxConnections": 100,
  "quiet": false
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `port` | WebSocket server port | `9090` |
| `authSecret` | Global authentication secret (optional) | `""` (open) |
| `maxConnections` | Max concurrent WebSocket connections | `100` |
| `quiet` | Suppress log output | `false` |

Environment variables (`PORT`, `AUTH_SECRET`, `DATA_DIR`) override config file values.

### Run Locally

```bash
cd server
cp config.example.json config.json   # edit with your settings
yarn install
yarn dev                              # development (hot reload)
```

### Deploy to Fly.io

```bash
cd server
fly apps create noted-sync
fly volumes create noted_data --region iad --size 1
fly secrets set AUTH_SECRET=your-secret
fly deploy
```

Server URL: `wss://noted-sync.fly.dev`

### Deploy to a VPS

```bash
# On the server
git clone <repo> && cd noted/server
yarn install && yarn build

# Run with PM2
PORT=9090 AUTH_SECRET=your-secret pm2 start dist/index.js --name noted-sync

# Reverse proxy with Caddy (auto HTTPS)
echo "sync.yourdomain.com { reverse_proxy localhost:9090 }" > /etc/caddy/Caddyfile
systemctl restart caddy
```

### Docker

```bash
cd server
docker build -t noted-sync .
docker run -d -p 9090:8080 -v noted_data:/data -e AUTH_SECRET=your-secret noted-sync
```

## App Configuration

### Default Sync URL

`app.config.json` (project root, bundled with the app):
```json
{
  "syncServerUrl": "wss://noted-sync.fly.dev",
  "syncAuthToken": "your-global-secret"
}
```

This sets the default for all users. The `syncAuthToken` must match the server's `authSecret`.

### User Override

Users can change the sync server in **Settings > Collaboration**:
- **Sync server** — WebSocket URL
- **Auth token** — Global authentication token

User settings override `app.config.json` and are stored in the local database.

## Sharing Flow

### Share a Note

1. Open a note
2. Click the share icon (top-right controls)
3. Click **Share & copy code**
4. A share code is generated and copied to clipboard
5. Send the code to your collaborator

### Join a Shared Note

1. Click the share icon on any note
2. Click **Join shared note**
3. Paste the share code
4. Click **Join** — a new note is created linked to the shared document

### Stop Sharing

1. Open the shared note
2. Click the share icon
3. Click **Stop sharing** — the sync_id and secret are removed

## How It Works Internally

1. **Sharing:** The app generates a `sync_id` (UUID) and `sync_secret` (random hex). Both are stored in the local `notes` table. The share code = `syncId.docSecret`.

2. **Connecting:** When a shared note is opened, the TipTap editor creates a Yjs `Y.Doc` and connects a `HocuspocusProvider` to the sync server using the `sync_id` as the document name and the `sync_secret` as the auth token.

3. **Editor mode:** The `@tiptap/extension-collaboration` extension replaces the normal document model with Yjs. StarterKit's history is disabled (Yjs handles undo/redo).

4. **Persistence:** The server stores Yjs document state in SQLite. On reconnect, the stored state is loaded and merged with any local changes.

5. **Local cache:** The app's `onUpdate` handler still saves to local SQLite on every edit, so the note is available offline.

## Data Storage

### Server (`server/data/sync.sqlite`)

| Table | Purpose |
|-------|---------|
| `documents` | Yjs document state (binary blob) per sync_id |
| `document_tokens` | SHA-256 hashed access tokens per document |

### App (notes table)

| Column | Purpose |
|--------|---------|
| `sync_id` | UUID identifying the Yjs document on the server |
| `sync_secret` | Per-document access token (stored locally, sent to server) |
| `is_shared` | Whether the note is actively shared |
