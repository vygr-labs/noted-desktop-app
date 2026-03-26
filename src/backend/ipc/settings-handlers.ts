import { ipcMain } from 'electron'
import {
	getSetting,
	setSetting,
} from '../database/settings-operations.js'
import { APP_CONFIG } from '../constants.js'

export function registerSettingsHandlers() {
	ipcMain.handle('settings:get', (_, key: string) => getSetting(key))
	ipcMain.handle('settings:set', (_, key: string, value: string) =>
		setSetting(key, value)
	)
	ipcMain.handle('settings:get-app-config', () => APP_CONFIG)
}
