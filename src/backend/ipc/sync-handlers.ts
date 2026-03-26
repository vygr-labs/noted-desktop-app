import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import db, { generateId } from '../database/db.js'
import { getSetting } from '../database/settings-operations.js'

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
	// Share a note — generates sync_id + doc_secret, returns share code
	ipcMain.handle('sync:share-note', (_, noteId: string) => {
		const note = db.prepare('SELECT id, sync_id, sync_secret FROM notes WHERE id = ?').get(noteId) as
			| { id: string; sync_id: string | null; sync_secret: string | null }
			| undefined
		if (!note) return null

		// If already shared, return existing share code
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

	// Stop sharing a note
	ipcMain.handle('sync:unshare-note', (_, noteId: string) => {
		db.prepare(
			'UPDATE notes SET sync_id = NULL, sync_secret = NULL, is_shared = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(noteId)
	})

	// Join a shared note by share code
	ipcMain.handle('sync:join-note', (_, shareCode: string) => {
		const parsed = parseShareCode(shareCode)
		if (!parsed) return null

		// Check if we already have a note with this sync_id
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
}
