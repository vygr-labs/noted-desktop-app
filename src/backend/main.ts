import path from 'node:path'
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import electronUpdater from 'electron-updater'
import electronIsDev from 'electron-is-dev'
import ElectronStore from 'electron-store'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { RESOURCES_PATH } from './constants.js'
import {
	fetchAllNotes,
	createNote,
	updateNote,
	deleteNote,
} from './database/note-operations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const { autoUpdater } = electronUpdater
let appWindow: BrowserWindow | null = null
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const store = new ElectronStore()

class AppUpdater {
	constructor() {
		log.transports.file.level = 'info'
		autoUpdater.logger = log
		autoUpdater.checkForUpdatesAndNotify()
	}
}

const PRELOAD_PATH = path.join(__dirname, 'preload.js')
const getAssetPath = (...paths: string[]): string => {
	return path.join(RESOURCES_PATH, ...paths)
}

const spawnAppWindow = async () => {
	appWindow = new BrowserWindow({
		width: 900,
		height: 670,
		icon: getAssetPath('icon.png'),
		title: electronIsDev
			? 'Astro Electron App - Development'
			: 'Astro Electron App',
		show: false,
		webPreferences: {
			preload: PRELOAD_PATH,
			webSecurity: !electronIsDev,
		},
	})

	appWindow.loadURL(
		electronIsDev
			? 'http://localhost:7241'
			: `file://${path.join(__dirname, '../../dist/index.html')}`
	)
	appWindow.maximize()
	appWindow.show()

	if (electronIsDev) appWindow.webContents.openDevTools({ mode: 'right' })

	appWindow.on('closed', () => {
		appWindow = null
	})
}

app.on('ready', () => {
	new AppUpdater()
	spawnAppWindow()
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

/*
 * ======================================================================================
 *                                IPC Main Events
 * ======================================================================================
 */

// Sample ping handler
ipcMain.handle('sample:ping', () => {
	return 'pong'
})

// Dark mode handlers
ipcMain.handle('dark-mode:toggle', () => {
	if (nativeTheme.shouldUseDarkColors) {
		nativeTheme.themeSource = 'light'
	} else {
		nativeTheme.themeSource = 'dark'
	}
	return nativeTheme.shouldUseDarkColors
})

ipcMain.on('dark-mode:update', (_, newTheme: 'light' | 'dark') => {
	nativeTheme.themeSource = newTheme
})

ipcMain.on('dark-mode:system', () => {
	nativeTheme.themeSource = 'system'
})

// Notes CRUD handlers
ipcMain.handle('notes:fetch-all', () => fetchAllNotes())
ipcMain.handle('notes:create', (_, title, content) => createNote(title, content))
ipcMain.handle('notes:update', (_, id, title, content) => updateNote(id, title, content))
ipcMain.handle('notes:delete', (_, id) => deleteNote(id))
