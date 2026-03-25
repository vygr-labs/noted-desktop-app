import db, { generateId } from './db.js'

export interface Note {
	id: string
	title: string
	content: string | null
	content_plain: string | null
	note_type: 'rich' | 'plain'
	list_id: string | null
	is_daily: number
	daily_date: string | null
	is_pinned: number
	is_trashed: number
	spellcheck: number
	sync_id: string | null
	is_shared: number
	created_at: string
	updated_at: string
}

export type NoteSortOrder = 'updated_at' | 'created_at' | 'title'

export function fetchAllNotes(sort: NoteSortOrder = 'created_at'): Note[] {
	let orderCol: string
	if (sort === 'title') orderCol = 'title ASC'
	else if (sort === 'created_at') orderCol = 'created_at ASC'
	else orderCol = `${sort} DESC`
	return db
		.prepare(
			`SELECT * FROM notes WHERE is_trashed = 0 ORDER BY is_pinned DESC, ${orderCol}`
		)
		.all() as Note[]
}

export function fetchNoteById(id: string): Note | undefined {
	return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as
		| Note
		| undefined
}

export function fetchNotesByList(listId: string, sort: NoteSortOrder = 'created_at'): Note[] {
	let orderCol: string
	if (sort === 'title') orderCol = 'title ASC'
	else if (sort === 'created_at') orderCol = 'created_at ASC'
	else orderCol = `${sort} DESC`
	return db
		.prepare(
			`SELECT * FROM notes WHERE list_id = ? AND is_trashed = 0 ORDER BY is_pinned DESC, ${orderCol}`
		)
		.all(listId) as Note[]
}

export function fetchTrashedNotes(): Note[] {
	return db
		.prepare('SELECT * FROM notes WHERE is_trashed = 1 ORDER BY updated_at DESC')
		.all() as Note[]
}

export function fetchDailyNote(date: string): Note | undefined {
	return db
		.prepare('SELECT * FROM notes WHERE is_daily = 1 AND daily_date = ?')
		.get(date) as Note | undefined
}

export function createNote(data: {
	title?: string
	content?: string | null
	content_plain?: string | null
	note_type?: 'rich' | 'plain'
	list_id?: string | null
	is_daily?: boolean
	daily_date?: string | null
}): Note {
	const id = generateId()
	const title = data.title || 'Untitled'
	const content = data.content ?? null
	const contentPlain = data.content_plain ?? null
	const noteType = data.note_type || 'rich'
	const listId = data.list_id ?? null
	const isDaily = data.is_daily ? 1 : 0
	const dailyDate = data.daily_date ?? null

	db.prepare(
		`INSERT INTO notes (id, title, content, content_plain, note_type, list_id, is_daily, daily_date)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(id, title, content, contentPlain, noteType, listId, isDaily, dailyDate)

	// Update FTS
	db.prepare(
		'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
	).run(id, title, contentPlain || '')

	return fetchNoteById(id) as Note
}

export function updateNote(
	id: string,
	data: {
		title?: string
		content?: string | null
		content_plain?: string | null
		note_type?: 'rich' | 'plain'
		list_id?: string | null
		is_pinned?: boolean
		spellcheck?: boolean
	}
): Note | undefined {
	const existing = fetchNoteById(id)
	if (!existing) return undefined

	const title = data.title ?? existing.title
	const content = data.content !== undefined ? data.content : existing.content
	const contentPlain =
		data.content_plain !== undefined
			? data.content_plain
			: existing.content_plain
	const noteType = data.note_type ?? existing.note_type
	const listId = data.list_id !== undefined ? data.list_id : existing.list_id
	const isPinned =
		data.is_pinned !== undefined
			? data.is_pinned
				? 1
				: 0
			: existing.is_pinned
	const spellcheck =
		data.spellcheck !== undefined
			? data.spellcheck
				? 1
				: 0
			: existing.spellcheck

	db.prepare(
		`UPDATE notes SET title = ?, content = ?, content_plain = ?, note_type = ?,
		 list_id = ?, is_pinned = ?, spellcheck = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	).run(title, content, contentPlain, noteType, listId, isPinned, spellcheck, id)

	// Update FTS
	db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id)
	db.prepare(
		'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
	).run(id, title, contentPlain || '')

	return fetchNoteById(id)
}

export function trashNote(id: string): void {
	db.prepare(
		'UPDATE notes SET is_trashed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	).run(id)
	db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id)
}

export function restoreNote(id: string): void {
	const note = fetchNoteById(id)
	if (!note) return
	db.prepare(
		'UPDATE notes SET is_trashed = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	).run(id)
	db.prepare(
		'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
	).run(id, note.title, note.content_plain || '')
}

export function deleteNotePermanently(id: string): void {
	db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id)
	db.prepare('DELETE FROM notes WHERE id = ?').run(id)
}
