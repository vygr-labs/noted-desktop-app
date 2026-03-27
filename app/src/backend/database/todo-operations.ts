import db, { generateId } from './db.js'

export interface Todo {
	id: string
	note_id: string | null
	todo_list_id: string | null
	text: string
	description: string | null
	is_completed: number
	due_date: string | null
	source_daily_date: string | null
	sort_order: number
	created_at: string
	updated_at: string
}

export function fetchAllTodos(): Todo[] {
	return db
		.prepare('SELECT * FROM todos ORDER BY is_completed ASC, sort_order ASC, created_at DESC')
		.all() as Todo[]
}

export function fetchTodosByNote(noteId: string): Todo[] {
	return db
		.prepare(
			'SELECT * FROM todos WHERE note_id = ? ORDER BY sort_order ASC, created_at ASC'
		)
		.all(noteId) as Todo[]
}

export function fetchTodoById(id: string): Todo | undefined {
	return db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as
		| Todo
		| undefined
}

export function createTodo(data: {
	text: string
	note_id?: string | null
	todo_list_id?: string | null
	description?: string | null
	due_date?: string | null
	source_daily_date?: string | null
}): Todo {
	const id = generateId()
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM todos')
		.get() as { max: number | null }
	const sortOrder = (maxOrder?.max ?? -1) + 1

	db.prepare(
		`INSERT INTO todos (id, text, note_id, todo_list_id, description, due_date, source_daily_date, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		id,
		data.text,
		data.note_id ?? null,
		data.todo_list_id ?? null,
		data.description ?? null,
		data.due_date ?? null,
		data.source_daily_date ?? null,
		sortOrder
	)
	return fetchTodoById(id) as Todo
}

export function updateTodo(
	id: string,
	data: {
		text?: string
		description?: string | null
		is_completed?: boolean
		due_date?: string | null
		todo_list_id?: string | null
		sort_order?: number
	}
): Todo | undefined {
	const existing = fetchTodoById(id)
	if (!existing) return undefined

	const text = data.text ?? existing.text
	const description = data.description !== undefined ? data.description : existing.description
	const isCompleted =
		data.is_completed !== undefined
			? data.is_completed
				? 1
				: 0
			: existing.is_completed
	const dueDate =
		data.due_date !== undefined ? data.due_date : existing.due_date
	const todoListId =
		data.todo_list_id !== undefined ? data.todo_list_id : existing.todo_list_id
	const sortOrder = data.sort_order ?? existing.sort_order

	db.prepare(
		`UPDATE todos SET text = ?, description = ?, is_completed = ?, due_date = ?, todo_list_id = ?, sort_order = ?,
		 updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	).run(text, description, isCompleted, dueDate, todoListId, sortOrder, id)

	return fetchTodoById(id)
}

export function deleteTodo(id: string): void {
	db.prepare('DELETE FROM todos WHERE id = ?').run(id)
}

export function reorderTodos(ids: string[]): void {
	const stmt = db.prepare(
		'UPDATE todos SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	)
	const transaction = db.transaction(() => {
		ids.forEach((id, index) => {
			stmt.run(index, id)
		})
	})
	transaction()
}

export function rolloverTodos(fromDate: string, toDate: string): number {
	const result = db
		.prepare(
			`UPDATE todos SET source_daily_date = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE source_daily_date = ? AND is_completed = 0`
		)
		.run(toDate, fromDate)
	return result.changes
}

export function fetchTodosByList(listId: string): Todo[] {
	return db
		.prepare('SELECT * FROM todos WHERE todo_list_id = ? ORDER BY sort_order ASC, created_at ASC')
		.all(listId) as Todo[]
}

export function syncTodosFromRemote(listId: string, remoteTodos: {
	id: string
	text: string
	description: string | null
	is_completed: number
	due_date: string | null
	sort_order: number
}[]): void {
	const transaction = db.transaction(() => {
		const localTodos = fetchTodosByList(listId)
		const localMap = new Map(localTodos.map(t => [t.id, t]))
		const remoteIds = new Set(remoteTodos.map(t => t.id))

		// Delete todos that exist locally but not remotely
		for (const local of localTodos) {
			if (!remoteIds.has(local.id)) {
				db.prepare('DELETE FROM todos WHERE id = ?').run(local.id)
				db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(local.id)
			}
		}

		// Upsert remote todos
		for (const remote of remoteTodos) {
			db.prepare(
				`INSERT INTO todos (id, text, description, is_completed, due_date, todo_list_id, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET
				   text = excluded.text,
				   description = excluded.description,
				   is_completed = excluded.is_completed,
				   due_date = excluded.due_date,
				   todo_list_id = excluded.todo_list_id,
				   sort_order = excluded.sort_order,
				   updated_at = CURRENT_TIMESTAMP`
			).run(remote.id, remote.text, remote.description, remote.is_completed, remote.due_date, listId, remote.sort_order)
		}
	})
	transaction()
}
