import { ipcMain } from 'electron'
import { getOrCreateDailyNote } from '../database/daily-note-operations.js'

export function registerDailyHandlers() {
	ipcMain.handle('daily:get-or-create', (_, date: string) =>
		getOrCreateDailyNote(date)
	)
}
