import db, { generateId } from './db.js'

export interface Tag {
	id: string
	name: string
	color: string
	created_at: string
}

export function fetchAllTags(): Tag[] {
	return db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as Tag[]
}

export function fetchTagById(id: string): Tag | undefined {
	return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as
		| Tag
		| undefined
}

export function fetchTagsForNote(noteId: string): Tag[] {
	return db
		.prepare(
			`SELECT t.* FROM tags t
		 INNER JOIN note_tags nt ON nt.tag_id = t.id
		 WHERE nt.note_id = ?
		 ORDER BY t.name ASC`
		)
		.all(noteId) as Tag[]
}

export function createTag(name: string, color?: string): Tag {
	const id = generateId()
	db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(
		id,
		name,
		color || 'gray'
	)
	return fetchTagById(id) as Tag
}

export function deleteTag(id: string): void {
	db.prepare('DELETE FROM tags WHERE id = ?').run(id)
}

export function addTagToNote(noteId: string, tagId: string): void {
	db.prepare(
		'INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)'
	).run(noteId, tagId)
}

export function removeTagFromNote(noteId: string, tagId: string): void {
	db.prepare('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?').run(
		noteId,
		tagId
	)
}

export function fetchTagsForNotes(
	noteIds: string[]
): Record<string, Tag[]> {
	if (noteIds.length === 0) return {}
	const placeholders = noteIds.map(() => '?').join(', ')
	const rows = db
		.prepare(
			`SELECT nt.note_id, t.id, t.name, t.color, t.created_at
			 FROM note_tags nt
			 INNER JOIN tags t ON t.id = nt.tag_id
			 WHERE nt.note_id IN (${placeholders})
			 ORDER BY t.name ASC`
		)
		.all(...noteIds) as (Tag & { note_id: string })[]

	const result: Record<string, Tag[]> = {}
	for (const id of noteIds) {
		result[id] = []
	}
	for (const row of rows) {
		result[row.note_id].push({
			id: row.id,
			name: row.name,
			color: row.color,
			created_at: row.created_at,
		})
	}
	return result
}
