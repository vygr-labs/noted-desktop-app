import { ipcMain } from 'electron'
import { searchNotes } from '../database/search-operations.js'

export function registerSearchHandlers() {
	ipcMain.handle('search:notes', (_, query: string) => searchNotes(query))
}
