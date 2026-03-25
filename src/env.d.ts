/// <reference types="astro/client" />

// ==================== Database Types ====================

interface Note {
	id: string
	title: string
	content: string | null
	content_plain: string | null
	note_type: 'rich' | 'plain'
	list_id: string | null
	is_daily: number
	daily_date: string | null
	is_pinned: number
	is_trashed: number
	spellcheck: number
	sync_id: string | null
	is_shared: number
	created_at: string
	updated_at: string
}

interface NoteList {
	id: string
	name: string
	icon: string
	color: string
	sort_order: number
	created_at: string
	updated_at: string
}

interface Tag {
	id: string
	name: string
	color: string
	created_at: string
}

interface NoteTag {
	note_id: string
	tag_id: string
}

interface Todo {
	id: string
	note_id: string | null
	todo_list_id: string | null
	text: string
	is_completed: number
	due_date: string | null
	source_daily_date: string | null
	sort_order: number
	created_at: string
	updated_at: string
}

interface TodoListItem {
	id: string
	name: string
	color: string
	sort_order: number
	created_at: string
}

interface SearchResult {
	note_id: string
	title: string
	snippet: string
}

// ==================== View Types ====================

type SidebarView =
	| 'all'
	| 'today'
	| 'todos'
	| 'trash'
	| 'search'
	| { type: 'list'; listId: string }

type NoteSortOrder = 'updated_at' | 'created_at' | 'title'

interface NoteWithTags extends Note {
	tags: Tag[]
}

// ==================== Electron API ====================

interface ElectronAPI {
	// Dark mode
	darkModeToggle: () => Promise<boolean>
	darkModeUpdate: (newTheme: 'light' | 'dark') => void
	darkModeSystem: () => void

	// Notes
	fetchAllNotes: (sort?: NoteSortOrder) => Promise<Note[]>
	fetchNote: (id: string) => Promise<Note | undefined>
	fetchNotesByList: (listId: string, sort?: NoteSortOrder) => Promise<Note[]>
	fetchTrashedNotes: () => Promise<Note[]>
	fetchDailyNote: (date: string) => Promise<Note | undefined>
	createNote: (data: {
		title?: string
		content?: string | null
		content_plain?: string | null
		note_type?: 'rich' | 'plain'
		list_id?: string | null
		is_daily?: boolean
		daily_date?: string | null
	}) => Promise<Note>
	updateNote: (
		id: string,
		data: {
			title?: string
			content?: string | null
			content_plain?: string | null
			note_type?: 'rich' | 'plain'
			list_id?: string | null
			is_pinned?: boolean
			spellcheck?: boolean
		}
	) => Promise<Note | undefined>
	trashNote: (id: string) => Promise<void>
	restoreNote: (id: string) => Promise<void>
	deleteNotePermanently: (id: string) => Promise<void>

	// Lists
	fetchAllLists: () => Promise<NoteList[]>
	createList: (name: string, icon?: string, color?: string) => Promise<NoteList>
	updateList: (
		id: string,
		data: { name?: string; icon?: string; color?: string }
	) => Promise<NoteList | undefined>
	deleteList: (id: string) => Promise<void>
	reorderLists: (ids: string[]) => Promise<void>

	// Tags
	fetchAllTags: () => Promise<Tag[]>
	fetchTagsForNote: (noteId: string) => Promise<Tag[]>
	fetchTagsForNotes: (noteIds: string[]) => Promise<Record<string, Tag[]>>
	createTag: (name: string, color?: string) => Promise<Tag>
	deleteTag: (id: string) => Promise<void>
	addTagToNote: (noteId: string, tagId: string) => Promise<void>
	removeTagFromNote: (noteId: string, tagId: string) => Promise<void>

	// Todo Lists
	fetchAllTodoLists: () => Promise<TodoListItem[]>
	createTodoList: (name: string, color?: string) => Promise<TodoListItem>
	updateTodoList: (
		id: string,
		data: { name?: string; color?: string }
	) => Promise<TodoListItem | undefined>
	deleteTodoList: (id: string) => Promise<void>

	// Todos
	fetchAllTodos: () => Promise<Todo[]>
	fetchTodosByNote: (noteId: string) => Promise<Todo[]>
	createTodo: (data: {
		text: string
		note_id?: string | null
		todo_list_id?: string | null
		due_date?: string | null
		source_daily_date?: string | null
	}) => Promise<Todo>
	updateTodo: (
		id: string,
		data: {
			text?: string
			is_completed?: boolean
			due_date?: string | null
			todo_list_id?: string | null
			sort_order?: number
		}
	) => Promise<Todo | undefined>
	deleteTodo: (id: string) => Promise<void>
	rolloverTodos: (fromDate: string, toDate: string) => Promise<number>

	// Search
	searchNotes: (query: string) => Promise<SearchResult[]>

	// Sync
	shareNote: (noteId: string) => Promise<string | null>
	unshareNote: (noteId: string) => Promise<void>
	joinSharedNote: (syncId: string) => Promise<string>

	// Export
	exportNote: (noteId: string, format: string) => Promise<boolean>
	exportAllNotes: (format: string) => Promise<boolean>

	// CLI
	installCli: () => Promise<{ success: boolean; path?: string; error?: string }>
	uninstallCli: () => Promise<{ success: boolean; error?: string }>
	isCliInstalled: () => Promise<boolean>

	// Settings
	getSetting: (key: string) => Promise<string | null>
	setSetting: (key: string, value: string) => Promise<void>

	// Daily notes
	getOrCreateDailyNote: (date: string) => Promise<Note>

	// Quick capture
	openQuickCapture: () => Promise<void>
	submitQuickCapture: (text: string) => Promise<void>

	// Popout
	openPopout: (opts: { view: string; listId?: string; title?: string }) => Promise<void>
	popoutTogglePin: () => Promise<boolean>
	popoutIsPinned: () => Promise<boolean>
	popoutClose: () => Promise<void>
	popoutUpdateSkipTaskbar: (skip: boolean) => Promise<void>
	onPopoutTodosChanged: (callback: () => void) => void

	// Notes refresh
	onNotesRefresh: (callback: () => void) => void

	// Window controls
	windowMinimize: () => Promise<void>
	windowMaximize: () => Promise<boolean>
	windowClose: () => Promise<void>
	windowIsMaximized: () => Promise<boolean>
	onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => void
}

declare global {
	interface Window {
		electronAPI: ElectronAPI
	}
}
