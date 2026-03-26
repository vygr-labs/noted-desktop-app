import db, { generateId } from './db.js'

export interface TodoList {
	id: string
	name: string
	color: string
	sort_order: number
	created_at: string
}

export function fetchAllTodoLists(): TodoList[] {
	return db
		.prepare('SELECT * FROM todo_lists ORDER BY sort_order ASC, created_at ASC')
		.all() as TodoList[]
}

export function fetchTodoListById(id: string): TodoList | undefined {
	return db.prepare('SELECT * FROM todo_lists WHERE id = ?').get(id) as
		| TodoList
		| undefined
}

export function createTodoList(name: string, color?: string): TodoList {
	const id = generateId()
	const maxOrder = db
		.prepare('SELECT MAX(sort_order) as max FROM todo_lists')
		.get() as { max: number | null }
	const sortOrder = (maxOrder?.max ?? -1) + 1

	db.prepare(
		'INSERT INTO todo_lists (id, name, color, sort_order) VALUES (?, ?, ?, ?)'
	).run(id, name, color || 'gray', sortOrder)

	return fetchTodoListById(id) as TodoList
}

export function updateTodoList(
	id: string,
	data: { name?: string; color?: string }
): TodoList | undefined {
	const existing = fetchTodoListById(id)
	if (!existing) return undefined

	const name = data.name ?? existing.name
	const color = data.color ?? existing.color

	db.prepare('UPDATE todo_lists SET name = ?, color = ? WHERE id = ?').run(
		name,
		color,
		id
	)
	return fetchTodoListById(id)
}

export function deleteTodoList(id: string): void {
	db.prepare('DELETE FROM todo_lists WHERE id = ?').run(id)
}
