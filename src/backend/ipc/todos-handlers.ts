import { ipcMain, BrowserWindow } from 'electron'
import {
	fetchAllTodos,
	fetchTodosByNote,
	createTodo,
	updateTodo,
	deleteTodo,
	rolloverTodos,
} from '../database/todo-operations.js'

function broadcastTodosChanged(sender: Electron.WebContents) {
	for (const win of BrowserWindow.getAllWindows()) {
		if (win.webContents !== sender && !win.isDestroyed()) {
			win.webContents.send('popout:todos-changed')
		}
	}
}

export function registerTodosHandlers() {
	ipcMain.handle('todos:fetch-all', () => fetchAllTodos())
	ipcMain.handle('todos:fetch-by-note', (_, noteId: string) =>
		fetchTodosByNote(noteId)
	)
	ipcMain.handle('todos:create', (event, data) => {
		const result = createTodo(data)
		broadcastTodosChanged(event.sender)
		return result
	})
	ipcMain.handle('todos:update', (event, id: string, data) => {
		const result = updateTodo(id, data)
		broadcastTodosChanged(event.sender)
		return result
	})
	ipcMain.handle('todos:delete', (event, id: string) => {
		const result = deleteTodo(id)
		broadcastTodosChanged(event.sender)
		return result
	})
	ipcMain.handle('todos:rollover', (event, fromDate: string, toDate: string) => {
		const result = rolloverTodos(fromDate, toDate)
		broadcastTodosChanged(event.sender)
		return result
	})
}
