# Security

## Note Locking

Individual notes can be locked with a PIN. Locked notes show a blurred overlay and require authentication to view.

### PIN Storage

- PINs are hashed using Node.js `scrypt` (64-byte output) with a random 16-byte salt
- The hash and salt are stored in the `settings` table (`lock_pin_hash`, `lock_pin_salt`)
- The raw PIN is never stored

### Session-Based Unlock

Once unlocked, a note stays accessible until the app is closed. Unlocked note IDs are tracked in memory only — they don't persist to disk.

### Biometric Authentication

On macOS, Touch ID can be used instead of entering the PIN. This uses Electron's `systemPreferences.promptTouchID()`. Other platforms fall back to PIN only.

## Sync Security

### Per-Document Access Tokens

Each shared note has a unique `sync_secret` — a cryptographically random 32-character hex string generated with `crypto.randomBytes(16)`.

The share code format is `syncId.docSecret`:
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890.9f8e7d6c5b4a3928170615243342516f
└── sync_id (UUID)                      └── sync_secret (random hex)
```

Both parts are required to access a document. The sync_id alone is not sufficient.

### Server-Side Token Validation

1. Tokens are hashed with SHA-256 before storage — the server never stores raw secrets
2. The first connection to a new document registers the token hash as "owner"
3. Subsequent connections must provide a token whose hash matches a registered entry
4. Unrecognized tokens are rejected with "Access denied"

### Global Server Authentication

An optional `authSecret` can be set in the server config. When set:
- All clients must prefix their token with the global secret: `globalSecret:docSecret`
- Connections without the correct prefix are rejected immediately
- This prevents unauthorized users from connecting to the server at all

### Data in Transit

- Use `wss://` (WebSocket over TLS) in production — configure via reverse proxy (Caddy, nginx) or Fly.io (auto-TLS)
- Never use `ws://` in production

### Data at Rest

- Server stores Yjs document state as binary blobs in SQLite
- Document access tokens are stored as SHA-256 hashes
- The server SQLite database should be on encrypted storage in production

## Content Security

### Electron Security

The app runs with:
- `contextIsolation: true` — renderer can't access Node.js directly
- `nodeIntegration: false` — all IPC goes through the preload bridge
- Security warnings appear in dev mode but are suppressed in production

### Export Security

Locked notes can still be exported if the user has unlocked them in the current session. The lock is a UI-level protection, not encryption — the content is stored as plaintext in SQLite.

For true encryption at rest, consider encrypting the `content` field before writing to the database (not currently implemented).
