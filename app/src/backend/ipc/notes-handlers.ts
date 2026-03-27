import { ipcMain, BrowserWindow } from 'electron'
import {
	fetchAllNotes,
	fetchNoteById,
	fetchNotesByList,
	fetchTrashedNotes,
	fetchDailyNote,
	createNote,
	updateNote,
	trashNote,
	restoreNote,
	deleteNotePermanently,
} from '../database/note-operations.js'

function broadcastNotesChanged(sender: Electron.WebContents) {
	for (const win of BrowserWindow.getAllWindows()) {
		if (win.webContents !== sender && !win.isDestroyed()) {
			win.webContents.send('popout:todos-changed')
		}
	}
}

export function registerNotesHandlers() {
	ipcMain.handle('notes:fetch-all', (_, sort?: string) => fetchAllNotes(sort as any))
	ipcMain.handle('notes:fetch', (_, id: string) => fetchNoteById(id))
	ipcMain.handle('notes:fetch-by-list', (_, listId: string, sort?: string) =>
		fetchNotesByList(listId, sort as any)
	)
	ipcMain.handle('notes:fetch-trashed', () => fetchTrashedNotes())
	ipcMain.handle('notes:fetch-daily', (_, date: string) =>
		fetchDailyNote(date)
	)
	ipcMain.handle('notes:create', (_, data) => createNote(data))
	ipcMain.handle('notes:update', (event, id: string, data) => {
		const result = updateNote(id, data)
		broadcastNotesChanged(event.sender)
		return result
	})
	ipcMain.handle('notes:trash', (_, id: string) => trashNote(id))
	ipcMain.handle('notes:restore', (_, id: string) => restoreNote(id))
	ipcMain.handle('notes:delete-permanently', (_, id: string) =>
		deleteNotePermanently(id)
	)
}
