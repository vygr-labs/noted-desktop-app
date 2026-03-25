/* eslint-disable @typescript-eslint/no-var-requires */
// Electron doesnt support ESM for renderer process. Alternatively, pass this file
// through a bundler but that feels like an overkill
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
	// Dark mode
	darkModeToggle: () => ipcRenderer.invoke('dark-mode:toggle'),
	darkModeUpdate: (newTheme: 'light' | 'dark') =>
		ipcRenderer.send('dark-mode:update', newTheme),
	darkModeSystem: () => ipcRenderer.send('dark-mode:system'),

	// Notes
	fetchAllNotes: (sort?: string) => ipcRenderer.invoke('notes:fetch-all', sort),
	fetchNote: (id: string) => ipcRenderer.invoke('notes:fetch', id),
	fetchNotesByList: (listId: string, sort?: string) =>
		ipcRenderer.invoke('notes:fetch-by-list', listId, sort),
	fetchTrashedNotes: () => ipcRenderer.invoke('notes:fetch-trashed'),
	fetchDailyNote: (date: string) =>
		ipcRenderer.invoke('notes:fetch-daily', date),
	createNote: (data: Record<string, unknown>) =>
		ipcRenderer.invoke('notes:create', data),
	updateNote: (id: string, data: Record<string, unknown>) =>
		ipcRenderer.invoke('notes:update', id, data),
	trashNote: (id: string) => ipcRenderer.invoke('notes:trash', id),
	restoreNote: (id: string) => ipcRenderer.invoke('notes:restore', id),
	deleteNotePermanently: (id: string) =>
		ipcRenderer.invoke('notes:delete-permanently', id),

	// Lists
	fetchAllLists: () => ipcRenderer.invoke('lists:fetch-all'),
	createList: (name: string, icon?: string, color?: string) =>
		ipcRenderer.invoke('lists:create', name, icon, color),
	updateList: (id: string, data: Record<string, unknown>) =>
		ipcRenderer.invoke('lists:update', id, data),
	deleteList: (id: string) => ipcRenderer.invoke('lists:delete', id),
	reorderLists: (ids: string[]) => ipcRenderer.invoke('lists:reorder', ids),

	// Tags
	fetchAllTags: () => ipcRenderer.invoke('tags:fetch-all'),
	fetchTagsForNote: (noteId: string) =>
		ipcRenderer.invoke('tags:fetch-for-note', noteId),
	fetchTagsForNotes: (noteIds: string[]) =>
		ipcRenderer.invoke('tags:fetch-for-notes', noteIds),
	createTag: (name: string, color?: string) =>
		ipcRenderer.invoke('tags:create', name, color),
	deleteTag: (id: string) => ipcRenderer.invoke('tags:delete', id),
	addTagToNote: (noteId: string, tagId: string) =>
		ipcRenderer.invoke('tags:add-to-note', noteId, tagId),
	removeTagFromNote: (noteId: string, tagId: string) =>
		ipcRenderer.invoke('tags:remove-from-note', noteId, tagId),

	// Todos
	fetchAllTodos: () => ipcRenderer.invoke('todos:fetch-all'),
	fetchTodosByNote: (noteId: string) =>
		ipcRenderer.invoke('todos:fetch-by-note', noteId),
	createTodo: (data: Record<string, unknown>) =>
		ipcRenderer.invoke('todos:create', data),
	updateTodo: (id: string, data: Record<string, unknown>) =>
		ipcRenderer.invoke('todos:update', id, data),
	deleteTodo: (id: string) => ipcRenderer.invoke('todos:delete', id),
	rolloverTodos: (fromDate: string, toDate: string) =>
		ipcRenderer.invoke('todos:rollover', fromDate, toDate),

	// Todo Lists
	fetchAllTodoLists: () => ipcRenderer.invoke('todo-lists:fetch-all'),
	createTodoList: (name: string, color?: string) =>
		ipcRenderer.invoke('todo-lists:create', name, color),
	updateTodoList: (id: string, data: Record<string, unknown>) =>
		ipcRenderer.invoke('todo-lists:update', id, data),
	deleteTodoList: (id: string) => ipcRenderer.invoke('todo-lists:delete', id),

	// Search
	searchNotes: (query: string) => ipcRenderer.invoke('search:notes', query),

	// Export
	exportNote: (noteId: string, format: string) => ipcRenderer.invoke('export:note', noteId, format),
	exportAllNotes: (format: string) => ipcRenderer.invoke('export:all', format),

	// CLI
	installCli: () => ipcRenderer.invoke('cli:install'),
	uninstallCli: () => ipcRenderer.invoke('cli:uninstall'),
	isCliInstalled: () => ipcRenderer.invoke('cli:is-installed'),

	// Settings
	getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
	setSetting: (key: string, value: string) =>
		ipcRenderer.invoke('settings:set', key, value),

	// Daily notes
	getOrCreateDailyNote: (date: string) =>
		ipcRenderer.invoke('daily:get-or-create', date),

	// Quick capture
	openQuickCapture: () => ipcRenderer.invoke('quick-capture:open'),
	submitQuickCapture: (text: string) =>
		ipcRenderer.invoke('quick-capture:submit', text),

	// Popout
	openPopout: (opts: { view: string; listId?: string; title?: string }) =>
		ipcRenderer.invoke('popout:open', opts),
	popoutTogglePin: () => ipcRenderer.invoke('popout:toggle-pin'),
	popoutIsPinned: () => ipcRenderer.invoke('popout:is-pinned'),
	popoutClose: () => ipcRenderer.invoke('popout:close'),
	popoutUpdateSkipTaskbar: (skip: boolean) =>
		ipcRenderer.invoke('popout:update-skip-taskbar', skip),
	onPopoutTodosChanged: (callback: () => void) => {
		ipcRenderer.on('popout:todos-changed', () => callback())
	},

	// Notes refresh
	onNotesRefresh: (callback: () => void) => {
		ipcRenderer.on('notes:refresh', () => callback())
	},

	// Window controls
	windowMinimize: () => ipcRenderer.invoke('window:minimize'),
	windowMaximize: () => ipcRenderer.invoke('window:maximize'),
	windowClose: () => ipcRenderer.invoke('window:close'),
	windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
	onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => {
		ipcRenderer.on('window:maximize-change', (_: unknown, isMaximized: boolean) => callback(isMaximized))
	},
})
