import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// A text file read from disk, ready to be imported as a note by the renderer.
// `name` is the base filename without extension (used as a fallback title),
// `ext` is the lowercased extension without the dot ('md', 'txt', …), and
// `text` is the raw UTF-8 contents.
export interface ImportedFile {
	name: string
	ext: string
	text: string
}

// Extensions offered in the open dialog / accepted from the OS "Open with"
// integration. Markdown variants become rich notes; everything else here is
// imported as plain text (see the renderer's buildNoteFromFile).
export const IMPORT_EXTENSIONS = [
	'md',
	'markdown',
	'mdown',
	'mkd',
	'txt',
	'text',
	'log',
]

// Refuse absurdly large files so a stray binary or huge log can't lock up the
// editor. 25 MB is far beyond any reasonable hand-written note.
const MAX_IMPORT_BYTES = 25 * 1024 * 1024

// Read a single path into an ImportedFile, or null if it isn't a readable
// regular file within the size limit. Shared by the open dialog and the
// OS file-association handling in main.ts.
export function readImportableFile(filePath: string): ImportedFile | null {
	try {
		const stat = fs.statSync(filePath)
		if (!stat.isFile() || stat.size > MAX_IMPORT_BYTES) return null
		const text = fs.readFileSync(filePath, 'utf-8')
		const base = path.basename(filePath)
		const ext = path.extname(base).slice(1).toLowerCase()
		const name = ext ? base.slice(0, base.length - ext.length - 1) : base
		return { name, ext, text }
	} catch {
		return null
	}
}

export function registerFileHandlers() {
	ipcMain.handle('file:open-dialog', async (event): Promise<ImportedFile[]> => {
		const win =
			BrowserWindow.fromWebContents(event.sender) ??
			BrowserWindow.getFocusedWindow() ??
			BrowserWindow.getAllWindows()[0]

		const result = await dialog.showOpenDialog(win!, {
			title: 'Open file in noted',
			properties: ['openFile', 'multiSelections'],
			filters: [
				{ name: 'Text & Markdown', extensions: IMPORT_EXTENSIONS },
				{ name: 'All Files', extensions: ['*'] },
			],
		})

		if (result.canceled) return []

		return result.filePaths
			.map(readImportableFile)
			.filter((f): f is ImportedFile => f !== null)
	})
}
