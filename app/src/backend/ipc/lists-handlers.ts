import { ipcMain } from 'electron'
import {
	fetchAllLists,
	fetchHiddenLists,
	createList,
	updateList,
	deleteList,
	hideList,
	unhideList,
	reorderLists,
} from '../database/list-operations.js'

export function registerListsHandlers() {
	ipcMain.handle('lists:fetch-all', () => fetchAllLists())
	ipcMain.handle('lists:fetch-hidden', () => fetchHiddenLists())
	ipcMain.handle(
		'lists:create',
		(_, name: string, icon?: string, color?: string) =>
			createList(name, icon, color)
	)
	ipcMain.handle('lists:update', (_, id: string, data) =>
		updateList(id, data)
	)
	ipcMain.handle('lists:delete', (_, id: string) => deleteList(id))
	ipcMain.handle('lists:hide', (_, id: string) => hideList(id))
	ipcMain.handle('lists:unhide', (_, id: string) => unhideList(id))
	ipcMain.handle('lists:reorder', (_, ids: string[]) => reorderLists(ids))
}
