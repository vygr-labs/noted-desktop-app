import { ipcMain } from 'electron'
import {
	fetchAllTags,
	fetchTagsForNote,
	fetchTagsForNotes,
	createTag,
	deleteTag,
	addTagToNote,
	removeTagFromNote,
} from '../database/tag-operations.js'

export function registerTagsHandlers() {
	ipcMain.handle('tags:fetch-all', () => fetchAllTags())
	ipcMain.handle('tags:fetch-for-note', (_, noteId: string) =>
		fetchTagsForNote(noteId)
	)
	ipcMain.handle('tags:fetch-for-notes', (_, noteIds: string[]) =>
		fetchTagsForNotes(noteIds)
	)
	ipcMain.handle('tags:create', (_, name: string, color?: string) =>
		createTag(name, color)
	)
	ipcMain.handle('tags:delete', (_, id: string) => deleteTag(id))
	ipcMain.handle('tags:add-to-note', (_, noteId: string, tagId: string) =>
		addTagToNote(noteId, tagId)
	)
	ipcMain.handle(
		'tags:remove-from-note',
		(_, noteId: string, tagId: string) => removeTagFromNote(noteId, tagId)
	)
}
