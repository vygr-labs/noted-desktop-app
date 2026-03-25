// ─── Noted Sync Server (Hocuspocus) ──────────────────────
// A self-hostable WebSocket sync server for real-time
// collaboration in the Noted app.
//
// Usage:
//   yarn dev          (development with hot reload)
//   yarn build && yarn start   (production)
//
// Environment variables:
//   PORT          — Server port (default: 9090)
//   AUTH_SECRET   — Shared secret for token validation (optional)

import { Server } from '@hocuspocus/server'
import Database from 'better-sqlite3'
import * as Y from 'yjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')

// ─── SQLite persistence ──────────────────────────────────

const db = new Database(path.join(DATA_DIR, 'sync.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
	CREATE TABLE IF NOT EXISTS documents (
		name TEXT PRIMARY KEY,
		data BLOB NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS document_access (
		document_name TEXT NOT NULL,
		user_token TEXT NOT NULL,
		role TEXT DEFAULT 'editor',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (document_name, user_token)
	);
`)

// ─── Server ──────────────────────────────────────────────

const port = parseInt(process.env.PORT || '9090')
const authSecret = process.env.AUTH_SECRET || ''

const server = new Server({
	port,
	quiet: false,

	async onAuthenticate({ token, documentName }) {
		if (!token) {
			throw new Error('Authentication required')
		}

		// If AUTH_SECRET is set, validate that the token contains it
		// In production, replace this with proper JWT/session validation
		if (authSecret && !token.startsWith(authSecret)) {
			throw new Error('Invalid token')
		}

		// Record access
		db.prepare(
			'INSERT OR IGNORE INTO document_access (document_name, user_token) VALUES (?, ?)'
		).run(documentName, token)

		return { user: token }
	},

	async onLoadDocument({ document, documentName }) {
		const row = db.prepare('SELECT data FROM documents WHERE name = ?').get(documentName) as
			| { data: Buffer }
			| undefined

		if (row) {
			const update = new Uint8Array(row.data)
			Y.applyUpdate(document, update)
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
		// Persist on disconnect to avoid data loss
		const state = Y.encodeStateAsUpdate(document)
		db.prepare(
			'INSERT OR REPLACE INTO documents (name, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
		).run(documentName, Buffer.from(state))
	},
})

server.listen().then(() => {
	console.log(`Noted sync server running on port ${port}`)
	console.log(`WebSocket: ws://localhost:${port}`)
	if (authSecret) {
		console.log('Authentication: enabled (AUTH_SECRET set)')
	} else {
		console.log('Authentication: open (set AUTH_SECRET for production)')
	}
})
