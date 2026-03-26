// ─── Noted Sync Server (Hocuspocus) ──────────────────────
//
// Config: server/config.json (or env vars override)
// Data:   server/data/sync.sqlite (or DATA_DIR env var)
//
// Security: per-document access tokens. The share code is
//   "syncId.docSecret" — both parts are required to connect.
//   First connection with a valid secret becomes the owner.
//   Subsequent connections must provide a registered secret.

import { Hocuspocus } from '@hocuspocus/server'
import { createServer } from 'node:http'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import * as Y from 'yjs'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ──────────────────────────────────────────────

interface ServerConfig {
	port: number
	authSecret: string
	maxConnections: number
	quiet: boolean
}

function loadConfig(): ServerConfig {
	const defaults: ServerConfig = {
		port: 9090,
		authSecret: '',
		maxConnections: 100,
		quiet: false,
	}

	try {
		const configPath = path.join(__dirname, '..', 'config.json')
		if (fs.existsSync(configPath)) {
			const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
			Object.assign(defaults, data)
		}
	} catch { /* use defaults */ }

	// Env vars override config file
	if (process.env.PORT) defaults.port = parseInt(process.env.PORT)
	if (process.env.AUTH_SECRET) defaults.authSecret = process.env.AUTH_SECRET

	return defaults
}

const config = loadConfig()

// ─── Data directory ──────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) {
	fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ─── SQLite ──────────────────────────────────────────────

const db = new Database(path.join(DATA_DIR, 'sync.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
	CREATE TABLE IF NOT EXISTS documents (
		name TEXT PRIMARY KEY,
		data BLOB NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS document_tokens (
		document_name TEXT NOT NULL,
		token_hash TEXT NOT NULL,
		role TEXT DEFAULT 'editor',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (document_name, token_hash)
	);
`)

function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex')
}

// ─── Server ──────────────────────────────────────────────

const hocuspocus = new Hocuspocus({
	quiet: config.quiet,

	async onAuthenticate({ token, documentName }) {
		if (!token) {
			throw new Error('Authentication required')
		}

		// Token format: "docSecret" (per-document secret from share code)
		// Optionally prefixed with global auth: "authSecret:docSecret"
		let docSecret = token

		// If a global authSecret is configured, require it as prefix
		if (config.authSecret) {
			if (!token.startsWith(config.authSecret + ':') && token !== config.authSecret) {
				throw new Error('Invalid server authentication')
			}
			// Extract the doc-specific part after the global prefix
			const parts = token.split(':')
			docSecret = parts.length > 1 ? parts.slice(1).join(':') : token
		}

		const hashed = hashToken(docSecret)

		// Check if document has any registered tokens
		const existing = db.prepare(
			'SELECT COUNT(*) as count FROM document_tokens WHERE document_name = ?'
		).get(documentName) as { count: number }

		if (existing.count === 0) {
			// First connection — register this token as owner
			db.prepare(
				'INSERT INTO document_tokens (document_name, token_hash, role) VALUES (?, ?, ?)'
			).run(documentName, hashed, 'owner')
		} else {
			// Validate against registered tokens
			const valid = db.prepare(
				'SELECT role FROM document_tokens WHERE document_name = ? AND token_hash = ?'
			).get(documentName, hashed) as { role: string } | undefined

			if (!valid) {
				throw new Error('Access denied — invalid document token')
			}
		}

		return { user: hashed.slice(0, 8) }
	},

	async onLoadDocument({ document, documentName }) {
		const row = db.prepare('SELECT data FROM documents WHERE name = ?').get(documentName) as
			| { data: Buffer }
			| undefined

		if (row) {
			Y.applyUpdate(document, new Uint8Array(row.data))
		}

		return document
	},

	async onStoreDocument({ document, documentName }) {
		const state = Y.encodeStateAsUpdate(document)
		db.prepare(
			'INSERT OR REPLACE INTO documents (name, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
		).run(documentName, Buffer.from(state))
	},

	async onDisconnect({ documentName, document }) {
		const state = Y.encodeStateAsUpdate(document)
		db.prepare(
			'INSERT OR REPLACE INTO documents (name, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
		).run(documentName, Buffer.from(state))
	},
})

// Custom HTTP server — returns 404 for non-WebSocket requests (hides server identity)
const httpServer = createServer((_req, res) => {
	res.writeHead(404)
	res.end()
})

httpServer.on('upgrade', (req, socket, head) => {
	hocuspocus.handleConnection(req, socket, head)
})

httpServer.listen(config.port, () => {
	console.log(`Noted sync server running on port ${config.port}`)
	console.log(`WebSocket: ws://localhost:${config.port}`)
	console.log(`Auth: ${config.authSecret ? 'global secret + per-document tokens' : 'per-document tokens only'}`)
})
