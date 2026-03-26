import path from 'node:path'
import {
	app,
	BrowserWindow,
	ipcMain,
	nativeTheme,
	globalShortcut,
} from 'electron'
import log from 'electron-log'
import electronUpdater from 'electron-updater'
import electronIsDev from 'electron-is-dev'
import ElectronStore from 'electron-store'
import url from 'url'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { RESOURCES_PATH } from './constants.js'
import { registerAllHandlers } from './ipc/register-all.js'
import { createNote } from './database/note-operations.js'
import { getSetting } from './database/settings-operations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const { autoUpdater } = electronUpdater
let appWindow: BrowserWindow | null = null
let quickCaptureWindow: BrowserWindow | null = null
const popoutWindows = new Map<string, BrowserWindow>()
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

function registerZoomShortcuts(win: BrowserWindow) {
	win.webContents.on('before-input-event', (event, input) => {
		if (!input.control && !input.meta) return
		if (input.key === '=' || input.key === '+') {
			win.webContents.zoomLevel += 0.5
			event.preventDefault()
		} else if (input.key === '-') {
			win.webContents.zoomLevel -= 0.5
			event.preventDefault()
		} else if (input.key === '0') {
			win.webContents.zoomLevel = 0
			event.preventDefault()
		}
	})
}

const spawnAppWindow = async () => {
	appWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 500,
		center: true,
		icon: getAssetPath('icon.png'),
		title: electronIsDev ? 'noted. - Development' : 'noted.',
		show: false,
		frame: false,
		webPreferences: {
			preload: PRELOAD_PATH,
			webSecurity: !electronIsDev,
		},
	})

	appWindow.loadURL(
		electronIsDev
			? 'http://localhost:7241'
			: url.format({
					slashes: true,
					protocol: 'file:',
					pathname: path.resolve(app.getAppPath(), 'dist/index.html'),
				})
	)

	appWindow.once('ready-to-show', () => {
		appWindow?.show()
	})

	registerZoomShortcuts(appWindow)

	if (electronIsDev) appWindow.webContents.openDevTools({ mode: 'right' })

	// Notify renderer when maximize state changes
	appWindow.on('maximize', () => {
		appWindow?.webContents.send('window:maximize-change', true)
	})
	appWindow.on('unmaximize', () => {
		appWindow?.webContents.send('window:maximize-change', false)
	})

	appWindow.on('closed', () => {
		appWindow = null
	})
}

function spawnQuickCaptureWindow() {
	if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
		quickCaptureWindow.show()
		quickCaptureWindow.focus()
		return
	}

	quickCaptureWindow = new BrowserWindow({
		width: 500,
		height: 220,
		frame: false,
		transparent: false,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: true,
		show: false,
		icon: getAssetPath('icon.png'),
		webPreferences: {
			preload: PRELOAD_PATH,
			webSecurity: !electronIsDev,
		},
	})

	quickCaptureWindow.loadURL(
		electronIsDev
			? 'http://localhost:7241/quick-capture'
			: url.format({
					slashes: true,
					protocol: 'file:',
					pathname: path.resolve(app.getAppPath(), 'dist/quick-capture.html'),
				})
	)

	quickCaptureWindow.once('ready-to-show', () => {
		quickCaptureWindow?.show()
		quickCaptureWindow?.focus()
	})

	quickCaptureWindow.on('blur', () => {
		quickCaptureWindow?.hide()
	})

	quickCaptureWindow.on('closed', () => {
		quickCaptureWindow = null
	})
}

function spawnPopoutWindow(opts: { view: string; listId?: string; title?: string }) {
	const key = `${opts.view}:${opts.listId || 'all'}`

	const existing = popoutWindows.get(key)
	if (existing && !existing.isDestroyed()) {
		existing.show()
		existing.focus()
		return
	}

	const params = new URLSearchParams({ view: opts.view })
	if (opts.listId) params.set('listId', opts.listId)
	if (opts.title) params.set('title', opts.title)

	const skipTaskbar = getSetting('popoutSkipTaskbar') === 'true'

	const popout = new BrowserWindow({
		width: 320,
		height: 480,
		minWidth: 240,
		minHeight: 200,
		frame: false,
		transparent: false,
		resizable: true,
		skipTaskbar,
		show: false,
		icon: getAssetPath('icon.png'),
		title: opts.title || 'noted.',
		webPreferences: {
			preload: PRELOAD_PATH,
			webSecurity: !electronIsDev,
		},
	})

	popout.loadURL(
		electronIsDev
			? `http://localhost:7241/popout?${params.toString()}`
			: url.format({
					slashes: true,
					protocol: 'file:',
					pathname: path.resolve(app.getAppPath(), 'dist/popout.html'),
					search: params.toString(),
				})
	)

	registerZoomShortcuts(popout)

	popout.once('ready-to-show', () => {
		popout.show()
	})

	popout.on('closed', () => {
		popoutWindows.delete(key)
	})

	popoutWindows.set(key, popout)
}

function registerGlobalShortcuts() {
	globalShortcut.register('CommandOrControl+Shift+N', () => {
		spawnQuickCaptureWindow()
	})
}

app.on('ready', () => {
	new AppUpdater()
	registerAllHandlers()
	registerAppHandlers()
	registerGlobalShortcuts()
	spawnAppWindow()
})

app.on('will-quit', () => {
	globalShortcut.unregisterAll()
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

function registerAppHandlers() {
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

	// Window controls
	ipcMain.handle('window:minimize', () => {
		appWindow?.minimize()
	})
	ipcMain.handle('window:maximize', () => {
		if (appWindow?.isMaximized()) {
			appWindow.unmaximize()
		} else {
			appWindow?.maximize()
		}
		return appWindow?.isMaximized() ?? false
	})
	ipcMain.handle('window:close', () => {
		appWindow?.close()
	})
	ipcMain.handle('window:is-maximized', () => {
		return appWindow?.isMaximized() ?? false
	})

	// Quick capture
	ipcMain.handle('quick-capture:open', () => {
		spawnQuickCaptureWindow()
	})

	// Popout
	ipcMain.handle('popout:open', (_, opts: { view: string; listId?: string; title?: string }) => {
		spawnPopoutWindow(opts)
	})

	ipcMain.handle('popout:toggle-pin', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		if (win) {
			const pinned = !win.isAlwaysOnTop()
			win.setAlwaysOnTop(pinned)
			return pinned
		}
		return false
	})

	ipcMain.handle('popout:is-pinned', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		return win?.isAlwaysOnTop() ?? false
	})

	ipcMain.handle('popout:close', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		win?.close()
	})

	ipcMain.handle('popout:update-skip-taskbar', (_, skip: boolean) => {
		for (const [, win] of popoutWindows) {
			if (!win.isDestroyed()) {
				win.setSkipTaskbar(skip)
			}
		}
	})

	ipcMain.handle('quick-capture:submit', (_, text: string) => {
		const note = createNote({
			title: text.split('\n')[0].slice(0, 100) || 'Quick Note',
			content: null,
			content_plain: text,
			note_type: 'plain',
		})
		quickCaptureWindow?.hide()
		// Notify the main window to refresh
		appWindow?.webContents.send('notes:refresh')
		return note
	})
}
