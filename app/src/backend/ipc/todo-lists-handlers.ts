import { ipcMain } from 'electron'
import {
	fetchAllTodoLists,
	createTodoList,
	updateTodoList,
	deleteTodoList,
} from '../database/todo-list-operations.js'

export function registerTodoListsHandlers() {
	ipcMain.handle('todo-lists:fetch-all', () => fetchAllTodoLists())
	ipcMain.handle(
		'todo-lists:create',
		(_, name: string, color?: string) => createTodoList(name, color)
	)
	ipcMain.handle(
		'todo-lists:update',
		(_, id: string, data: { name?: string; color?: string }) =>
			updateTodoList(id, data)
	)
	ipcMain.handle('todo-lists:delete', (_, id: string) =>
		deleteTodoList(id)
	)
}
