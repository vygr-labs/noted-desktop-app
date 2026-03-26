import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import db, { generateId } from '../database/db.js'

// Share code format: "type:syncId.docSecret"  (type = n|l|t)
// Also supports legacy format "syncId.docSecret" (treated as note)
function makeShareCode(type: 'n' | 'l' | 't', syncId: string, docSecret: string): string {
	return `${type}:${syncId}.${docSecret}`
}

function parseShareCode(code: string): { type: string; syncId: string; docSecret: string } | null {
	// New format: "type:syncId.secret"
	const colonIdx = code.indexOf(':')
	if (colonIdx !== -1) {
		const type = code.slice(0, colonIdx)
		const rest = code.slice(colonIdx + 1)
		const dot = rest.indexOf('.')
		if (dot === -1) return null
		return { type, syncId: rest.slice(0, dot), docSecret: rest.slice(dot + 1) }
	}
	// Legacy format: "syncId.secret" (assume note)
	const dot = code.indexOf('.')
	if (dot === -1) return null
	return { type: 'n', syncId: code.slice(0, dot), docSecret: code.slice(dot + 1) }
}

export function registerSyncHandlers() {
	// ─── Note sharing ───────────────────────────────────
	ipcMain.handle('sync:share-note', (_, noteId: string) => {
		const note = db.prepare('SELECT id, sync_id, sync_secret FROM notes WHERE id = ?').get(noteId) as
			| { id: string; sync_id: string | null; sync_secret: string | null }
			| undefined
		if (!note) return null

		if (note.sync_id && note.sync_secret) {
			return makeShareCode('n', note.sync_id, note.sync_secret)
		}

		const syncId = generateId()
		const docSecret = crypto.randomBytes(16).toString('hex')
		db.prepare(
			'UPDATE notes SET sync_id = ?, sync_secret = ?, is_shared = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(syncId, docSecret, noteId)

		return makeShareCode('n', syncId, docSecret)
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
			return makeShareCode('l', list.sync_id, list.sync_secret)
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

		return makeShareCode('l', syncId, docSecret)
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

	// ─── Todo list sharing ──────────────────────────────
	ipcMain.handle('sync:share-todo-list', (_, listId: string) => {
		const list = db.prepare('SELECT id, sync_id, sync_secret FROM todo_lists WHERE id = ?').get(listId) as
			| { id: string; sync_id: string | null; sync_secret: string | null }
			| undefined
		if (!list) return null

		if (list.sync_id && list.sync_secret) {
			return makeShareCode('t', list.sync_id, list.sync_secret)
		}

		const syncId = generateId()
		const docSecret = crypto.randomBytes(16).toString('hex')
		db.prepare(
			'UPDATE todo_lists SET sync_id = ?, sync_secret = ?, is_shared = 1 WHERE id = ?'
		).run(syncId, docSecret, listId)

		return makeShareCode('t', syncId, docSecret)
	})

	ipcMain.handle('sync:unshare-todo-list', (_, listId: string) => {
		db.prepare(
			'UPDATE todo_lists SET sync_id = NULL, sync_secret = NULL, is_shared = 0 WHERE id = ?'
		).run(listId)
	})

	ipcMain.handle('sync:join-todo-list', (_, shareCode: string) => {
		const parsed = parseShareCode(shareCode)
		if (!parsed) return null

		const existing = db.prepare('SELECT id FROM todo_lists WHERE sync_id = ?').get(parsed.syncId) as
			| { id: string }
			| undefined
		if (existing) return existing.id

		const id = generateId()
		db.prepare(
			`INSERT INTO todo_lists (id, name, color, sort_order, sync_id, sync_secret, is_shared)
			 VALUES (?, 'Shared Todos', 'gray', (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todo_lists), ?, ?, 1)`
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
