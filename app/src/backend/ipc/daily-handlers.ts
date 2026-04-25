import { ipcMain } from 'electron'
import { getOrCreateDailyNote } from '../database/daily-note-operations.js'
import { fetchAllDailyNotes } from '../database/note-operations.js'

export function registerDailyHandlers() {
	ipcMain.handle('daily:get-or-create', (_, date: string) =>
		getOrCreateDailyNote(date)
	)
	ipcMain.handle('daily:fetch-all', () => fetchAllDailyNotes())
}
