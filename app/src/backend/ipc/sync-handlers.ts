import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import db, { generateId } from '../database/db.js'

// Share code format: "syncId.docSecret"
function makeShareCode(syncId: string, docSecret: string): string {
	return `${syncId}.${docSecret}`
}

function parseShareCode(code: string): { syncId: string; docSecret: string } | null {
	const dot = code.indexOf('.')
	if (dot === -1) return null
	return { syncId: code.slice(0, dot), docSecret: code.slice(dot + 1) }
}

export function registerSyncHandlers() {
	// ─── Note sharing ───────────────────────────────────
	ipcMain.handle('sync:share-note', (_, noteId: string) => {
		const note = db.prepare('SELECT id, sync_id, sync_secret FROM notes WHERE id = ?').get(noteId) as
			| { id: string; sync_id: string | null; sync_secret: string | null }
			| undefined
		if (!note) return null

		if (note.sync_id && note.sync_secret) {
			return makeShareCode(note.sync_id, note.sync_secret)
		}

		const syncId = generateId()
		const docSecret = crypto.randomBytes(16).toString('hex')
		db.prepare(
			'UPDATE notes SET sync_id = ?, sync_secret = ?, is_shared = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(syncId, docSecret, noteId)

		return makeShareCode(syncId, docSecret)
	})

	ipcMain.handle('sync:unshare-note', (_, noteId: string) => {
		db.prepare(
			'UPDATE notes SET sync_id = NULL, sync_secret = NULL, is_shared = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(noteId)
	})

	ipcMain.handle('sync:join-note', (_, shareCode: string) => {
		const parsed = parseShareCode(shareCode)
		if (!parsed) return null

		const existing = db.prepare('SELECT id FROM notes WHERE sync_id = ?').get(parsed.syncId) as
			| { id: string }
			| undefined
		if (existing) return existing.id

		const id = generateId()
		db.prepare(
			`INSERT INTO notes (id, title, note_type, sync_id, sync_secret, is_shared)
			 VALUES (?, 'Shared Note', 'rich', ?, ?, 1)`
		).run(id, parsed.syncId, parsed.docSecret)

		db.prepare(
			'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
		).run(id, 'Shared Note', '')

		return id
	})

	// ─── List sharing ───────────────────────────────────
	ipcMain.handle('sync:share-list', (_, listId: string) => {
		const list = db.prepare('SELECT id, sync_id, sync_secret FROM lists WHERE id = ?').get(listId) as
			| { id: string; sync_id: string | null; sync_secret: string | null }
			| undefined
		if (!list) return null

		if (list.sync_id && list.sync_secret) {
			return makeShareCode(list.sync_id, list.sync_secret)
		}

		const syncId = generateId()
		const docSecret = crypto.randomBytes(16).toString('hex')
		db.prepare(
			'UPDATE lists SET sync_id = ?, sync_secret = ?, is_shared = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(syncId, docSecret, listId)

		// Auto-share all notes in this list that aren't already shared
		const notes = db.prepare('SELECT id FROM notes WHERE list_id = ? AND sync_id IS NULL AND is_trashed = 0').all(listId) as { id: string }[]
		for (const note of notes) {
			const noteSyncId = generateId()
			const noteDocSecret = crypto.randomBytes(16).toString('hex')
			db.prepare(
				'UPDATE notes SET sync_id = ?, sync_secret = ?, is_shared = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
			).run(noteSyncId, noteDocSecret, note.id)
		}

		return makeShareCode(syncId, docSecret)
	})

	ipcMain.handle('sync:unshare-list', (_, listId: string) => {
		db.prepare(
			'UPDATE lists SET sync_id = NULL, sync_secret = NULL, is_shared = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(listId)

		// Unshare all notes in this list
		db.prepare(
			'UPDATE notes SET sync_id = NULL, sync_secret = NULL, is_shared = 0, updated_at = CURRENT_TIMESTAMP WHERE list_id = ?'
		).run(listId)
	})

	ipcMain.handle('sync:join-list', (_, shareCode: string) => {
		const parsed = parseShareCode(shareCode)
		if (!parsed) return null

		const existing = db.prepare('SELECT id FROM lists WHERE sync_id = ?').get(parsed.syncId) as
			| { id: string }
			| undefined
		if (existing) return existing.id

		const id = generateId()
		db.prepare(
			`INSERT INTO lists (id, name, icon, color, sort_order, sync_id, sync_secret, is_shared)
			 VALUES (?, 'Shared List', 'folder', 'gray', (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM lists), ?, ?, 1)`
		).run(id, parsed.syncId, parsed.docSecret)

		return id
	})

	// ─── Shared items queries ───────────────────────────
	ipcMain.handle('sync:get-shared-notes', () => {
		return db.prepare('SELECT * FROM notes WHERE is_shared = 1 AND is_trashed = 0').all()
	})

	ipcMain.handle('sync:get-shared-lists', () => {
		return db.prepare('SELECT * FROM lists WHERE is_shared = 1').all()
	})

	// ─── Yjs state persistence (offline-first) ──────────
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
