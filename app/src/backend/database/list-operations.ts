import db, { generateId } from './db.js'

export interface NoteList {
	id: string
	name: string
	icon: string
	color: string
	sort_order: number
	created_at: string
	updated_at: string
}

export function fetchAllLists(): NoteList[] {
	return db
		.prepare('SELECT * FROM lists ORDER BY sort_order ASC, created_at ASC')
		.all() as NoteList[]
}

export function fetchListById(id: string): NoteList | undefined {
	return db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as
		| NoteList
		| undefined
}

export function createList(
	name: string,
	icon?: string,
	color?: string
): NoteList {
	const id = generateId()
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM lists')
		.get() as { max: number | null }
	const sortOrder = (maxOrder?.max ?? -1) + 1

	db.prepare(
		'INSERT INTO lists (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)'
	).run(id, name, icon || 'folder', color || 'gray', sortOrder)

	return fetchListById(id) as NoteList
}

export function updateList(
	id: string,
	data: { name?: string; icon?: string; color?: string }
): NoteList | undefined {
	const existing = fetchListById(id)
	if (!existing) return undefined

	const name = data.name ?? existing.name
	const icon = data.icon ?? existing.icon
	const color = data.color ?? existing.color

	db.prepare(
		'UPDATE lists SET name = ?, icon = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	).run(name, icon, color, id)

	return fetchListById(id)
}

export function deleteList(id: string): void {
	// Notes in this list get their list_id set to NULL (via ON DELETE SET NULL)
	db.prepare('DELETE FROM lists WHERE id = ?').run(id)
}

export function reorderLists(ids: string[]): void {
	const stmt = db.prepare(
		'UPDATE lists SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	)
	const transaction = db.transaction(() => {
		ids.forEach((id, index) => {
			stmt.run(index, id)
		})
	})
	transaction()
}
