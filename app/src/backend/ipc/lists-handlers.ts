import { ipcMain } from 'electron'
import {
	fetchAllLists,
	createList,
	updateList,
	deleteList,
	reorderLists,
} from '../database/list-operations.js'

export function registerListsHandlers() {
	ipcMain.handle('lists:fetch-all', () => fetchAllLists())
	ipcMain.handle(
		'lists:create',
		(_, name: string, icon?: string, color?: string) =>
			createList(name, icon, color)
	)
	ipcMain.handle('lists:update', (_, id: string, data) =>
		updateList(id, data)
	)
	ipcMain.handle('lists:delete', (_, id: string) => deleteList(id))
	ipcMain.handle('lists:reorder', (_, ids: string[]) => reorderLists(ids))
}
