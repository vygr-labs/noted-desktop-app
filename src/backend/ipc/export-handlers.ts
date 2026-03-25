import { ipcMain } from 'electron'
import { exportNote, exportAllNotes } from '../export/export-operations.js'

export function registerExportHandlers() {
	ipcMain.handle('export:note', (_, noteId: string, format: string) => exportNote(noteId, format))
	ipcMain.handle('export:all', (_, format: string) => exportAllNotes(format))
}
