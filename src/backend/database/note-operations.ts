import db from './db.js'

export interface Note {
	id: number
	title: string
	content: string | null
	created_at: string
	updated_at: string
}

export function fetchAllNotes(): Note[] {
	return db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as Note[]
}

export function fetchNoteById(id: number): Note | undefined {
	return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
}

export function createNote(title: string, content: string | null): Note {
	const stmt = db.prepare(
		'INSERT INTO notes (title, content) VALUES (?, ?)'
	)
	const result = stmt.run(title, content)
	return fetchNoteById(result.lastInsertRowid as number) as Note
}

export function updateNote(id: number, title: string, content: string | null): Note | undefined {
	db.prepare(
		'UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	).run(title, content, id)
	return fetchNoteById(id)
}

export function deleteNote(id: number): void {
	db.prepare('DELETE FROM notes WHERE id = ?').run(id)
}
