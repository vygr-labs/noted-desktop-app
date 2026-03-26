import db, { generateId } from './db.js'

export interface Todo {
	id: string
	note_id: string | null
	todo_list_id: string | null
	text: string
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
	due_date?: string | null
	source_daily_date?: string | null
}): Todo {
	const id = generateId()
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM todos')
		.get() as { max: number | null }
	const sortOrder = (maxOrder?.max ?? -1) + 1

	db.prepare(
		`INSERT INTO todos (id, text, note_id, todo_list_id, due_date, source_daily_date, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(
		id,
		data.text,
		data.note_id ?? null,
		data.todo_list_id ?? null,
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
		is_completed?: boolean
		due_date?: string | null
		todo_list_id?: string | null
		sort_order?: number
	}
): Todo | undefined {
	const existing = fetchTodoById(id)
	if (!existing) return undefined

	const text = data.text ?? existing.text
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
		`UPDATE todos SET text = ?, is_completed = ?, due_date = ?, todo_list_id = ?, sort_order = ?,
		 updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	).run(text, isCompleted, dueDate, todoListId, sortOrder, id)

	return fetchTodoById(id)
}

export function deleteTodo(id: string): void {
	db.prepare('DELETE FROM todos WHERE id = ?').run(id)
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
