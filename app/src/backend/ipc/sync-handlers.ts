import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import db, { generateId } from '../database/db.js'

function makeShareCode(syncId: string, docSecret: string): string {
	return `${syncId}.${docSecret}`
}

function parseShareCode(code: string): { syncId: string; docSecret: string } | null {
	// Strip noted://share/ prefix if present
	const cleaned = code.replace(/^noted:\/\/share\//, '')
	const dot = cleaned.indexOf('.')
	if (dot === -1) return null
	const syncId = cleaned.slice(0, dot)
	const docSecret = cleaned.slice(dot + 1)
	if (!syncId || !docSecret) return null
	return { syncId, docSecret }
}

export function registerSyncHandlers() {
	// ─── Share a note ──────────────────────────────────
	ipcMain.handle('sync:share-note', (_, noteId: string) => {
		const note = db.prepare('SELECT id, sync_id, sync_secret FROM notes WHERE id = ?').get(noteId) as
			| { id: string; sync_id: string | null; sync_secret: string | null }
			| undefined
		if (!note) return null

		// Already shared — return existing code
		if (note.sync_id && note.sync_secret) {
			return makeShareCode(note.sync_id, note.sync_secret)
		}

		// Generate new sync credentials
		const syncId = generateId()
		const docSecret = crypto.randomBytes(16).toString('hex')
		db.prepare(
			'UPDATE notes SET sync_id = ?, sync_secret = ?, is_shared = 1, is_owner = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(syncId, docSecret, noteId)

		return makeShareCode(syncId, docSecret)
	})

	// ─── Unshare a note ────────────────────────────────
	ipcMain.handle('sync:unshare-note', (_, noteId: string) => {
		db.prepare(
			'UPDATE notes SET sync_id = NULL, sync_secret = NULL, is_shared = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(noteId)
	})

	// ─── Join a shared note ────────────────────────────
	ipcMain.handle('sync:join-note', (_, shareCode: string, opts?: { title?: string }) => {
		const parsed = parseShareCode(shareCode)
		if (!parsed) return null

		// Already have this note locally?
		const existing = db.prepare('SELECT id FROM notes WHERE sync_id = ?').get(parsed.syncId) as
			| { id: string }
			| undefined
		if (existing) return existing.id

		// Create a new local note entry
		const title = opts?.title || 'Shared Note'
		const id = generateId()
		db.prepare(
			`INSERT INTO notes (id, title, note_type, sync_id, sync_secret, is_shared, is_owner)
			 VALUES (?, ?, 'rich', ?, ?, 1, 0)`
		).run(id, title, parsed.syncId, parsed.docSecret)

		// Add to FTS index
		db.prepare(
			'INSERT INTO notes_fts (rowid, title, content_plain) VALUES ((SELECT rowid FROM notes WHERE id = ?), ?, ?)'
		).run(id, title, '')

		return id
	})

	// ─── Yjs state persistence ─────────────────────────
	ipcMain.handle('sync:save-yjs-state', (_, docName: string, state: Uint8Array) => {
		db.prepare(
			'INSERT OR REPLACE INTO yjs_state (doc_name, state, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
		).run(docName, Buffer.from(state))
	})

	ipcMain.handle('sync:load-yjs-state', (_, docName: string) => {
		const row = db.prepare('SELECT state FROM yjs_state WHERE doc_name = ?').get(docName) as
			| { state: Buffer }
			| undefined
		return row ? new Uint8Array(row.state) : null
	})
}
