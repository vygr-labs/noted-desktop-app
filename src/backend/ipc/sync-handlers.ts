import { ipcMain } from 'electron'
import db, { generateId } from '../database/db.js'

export function registerSyncHandlers() {
	// Share a note — generates a sync_id and marks it shared
	ipcMain.handle('sync:share-note', (_, noteId: string) => {
		const note = db.prepare('SELECT id, sync_id FROM notes WHERE id = ?').get(noteId) as
			| { id: string; sync_id: string | null }
			| undefined
		if (!note) return null

		// If already shared, return existing sync_id
		if (note.sync_id) return note.sync_id

		const syncId = generateId()
		db.prepare(
			'UPDATE notes SET sync_id = ?, is_shared = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(syncId, noteId)

		return syncId
	})

	// Stop sharing a note
	ipcMain.handle('sync:unshare-note', (_, noteId: string) => {
		db.prepare(
			'UPDATE notes SET sync_id = NULL, is_shared = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
		).run(noteId)
	})

	// Join a shared note by sync_id — creates a local note linked to the remote document
	ipcMain.handle('sync:join-note', (_, syncId: string) => {
		// Check if we already have a note with this sync_id
		const existing = db.prepare('SELECT id FROM notes WHERE sync_id = ?').get(syncId) as
			| { id: string }
			| undefined
		if (existing) return existing.id

		const id = generateId()
		db.prepare(
			`INSERT INTO notes (id, title, note_type, sync_id, is_shared)
			 VALUES (?, 'Shared Note', 'rich', ?, 1)`
		).run(id, syncId)

		db.prepare(
			'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
		).run(id, 'Shared Note', '')

		return id
	})
}
