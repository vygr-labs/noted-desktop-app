import {
	createContext,
	useContext,
	createSignal,
	createResource,
	onMount,
	type ParentProps,
} from 'solid-js'
import { buildNoteFromFile } from '../lib/import-file'

type SidebarView =
	| 'all'
	| 'today'
	| 'synced'
	| 'todos'
	| 'trash'
	| 'search'
	| { type: 'list'; listId: string }

interface AppStore {
	// View state
	currentView: () => SidebarView
	setCurrentView: (view: SidebarView) => void
	selectedNoteId: () => string | null
	setSelectedNoteId: (id: string | null) => void
	searchQuery: () => string
	setSearchQuery: (q: string) => void
	sidebarCollapsed: () => boolean
	setSidebarCollapsed: (v: boolean) => void
	noteListCollapsed: () => boolean
	setNoteListCollapsed: (v: boolean) => void
	focusMode: () => boolean
	setFocusMode: (v: boolean) => void
	commandPaletteOpen: () => boolean
	setCommandPaletteOpen: (v: boolean) => void
	noteSearchOpen: () => boolean
	setNoteSearchOpen: (v: boolean) => void
	noteSort: () => NoteSortOrder
	setNoteSort: (sort: NoteSortOrder) => void
	showNotePreview: () => boolean
	setShowNotePreview: (v: boolean) => void
	selectedTodoListId: () => string | null
	setSelectedTodoListId: (id: string | null) => void

	// Data
	notes: () => Note[] | undefined
	lists: () => NoteList[] | undefined
	hiddenLists: () => NoteList[] | undefined
	tags: () => Tag[] | undefined
	todos: () => Todo[] | undefined
	todoLists: () => TodoListItem[] | undefined
	searchResults: () => SearchResult[] | undefined
	noteTagsMap: () => Record<string, Tag[]>
	loadTagsForNotes: (ids: string[]) => void
	refetchNotes: () => void
	refetchLists: () => void
	refetchHiddenLists: () => void
	refetchTags: () => void
	refetchTodos: () => void
	refetchTodoLists: () => void
	refetchSearch: () => void
	listNotesVersion: () => number
	bumpListNotes: () => void
	notesLoading: () => boolean

	// Import external text/markdown files as notes. `importFromDialog` opens the
	// native file picker; `importFiles` converts already-read files (also used
	// by the OS "Open with noted" integration).
	importFromDialog: () => Promise<void>
	importFiles: (files: ImportedFile[]) => Promise<void>
}

const AppStoreContext = createContext<AppStore>()

async function loadLists(): Promise<NoteList[]> {
	return window.electronAPI.fetchAllLists()
}

async function loadHiddenLists(): Promise<NoteList[]> {
	return window.electronAPI.fetchHiddenLists()
}

async function loadTags(): Promise<Tag[]> {
	return window.electronAPI.fetchAllTags()
}

async function loadTodos(): Promise<Todo[]> {
	return window.electronAPI.fetchAllTodos()
}

async function loadTodoLists(): Promise<TodoListItem[]> {
	return window.electronAPI.fetchAllTodoLists()
}

export function AppStoreProvider(props: ParentProps) {
	const [currentView, setCurrentView] = createSignal<SidebarView>('all')
	const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(null)
	const [searchQuery, setSearchQuery] = createSignal('')
	const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false)
	const [noteListCollapsed, setNoteListCollapsed] = createSignal(false)
	const [focusMode, setFocusMode] = createSignal(false)
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false)
	const [noteSearchOpen, setNoteSearchOpen] = createSignal(false)
	const [noteSort, _setNoteSort] = createSignal<NoteSortOrder>('updated_at')
	const [showNotePreview, _setShowNotePreview] = createSignal(true)
	const [selectedTodoListId, setSelectedTodoListId] = createSignal<string | null>(null)
	const [noteTagsMap, setNoteTagsMap] = createSignal<Record<string, Tag[]>>({})
	const [listNotesVersion, setListNotesVersion] = createSignal(0)
	function bumpListNotes() { setListNotesVersion(v => v + 1) }

	// Persist sort preference
	function setNoteSort(sort: NoteSortOrder) {
		_setNoteSort(sort)
		window.electronAPI.setSetting('noteSort', sort)
	}

	function setShowNotePreview(v: boolean) {
		_setShowNotePreview(v)
		window.electronAPI.setSetting('showNotePreview', v ? '1' : '0')
	}

	// Load saved sort on startup + listen for cross-window todo changes
	onMount(async () => {
		const saved = await window.electronAPI.getSetting('noteSort')
		if (saved === 'updated_at' || saved === 'created_at' || saved === 'title') {
			_setNoteSort(saved)
		}

		const savedPreview = await window.electronAPI.getSetting('showNotePreview')
		if (savedPreview === '0') _setShowNotePreview(false)

		window.electronAPI.onPopoutTodosChanged(() => {
			refetchTodos()
		})

		window.electronAPI.onNotesRefresh(() => {
			// Quick-capture only ever adds a note, so refetching the note list is
			// enough — no need to re-pull lists/tags on every capture.
			refetchNotes()
		})

		window.electronAPI.onExternalDbChange(() => {
			// noted-cli (or another process) committed a write. It may have touched
			// any table, so refresh every resource the sidebar/views depend on.
			refetchNotes()
			refetchLists()
			refetchTags()
			refetchTodos()
			refetchTodoLists()
			refetchSearch()
		})

		// A file opened via "Open with noted" (or a launch/second-instance arg)
		// arrives here — turn it into a note and open it.
		window.electronAPI.onImportFile((file: ImportedFile) => {
			importFiles([file])
		})

		// Signal main that the import listener is live, so any file queued from a
		// cold-start "Open with" gets delivered now.
		window.electronAPI.notifyRendererReady()

		// Handle noted://share/... deep links
		window.electronAPI.onDeepLink(async (url: string) => {
			const match = url.match(/^noted:\/\/share\/(.+)$/)
			if (!match) return
			const shareCode = decodeURIComponent(match[1])
			const noteId = await window.electronAPI.joinSharedNote(shareCode)
			if (noteId) {
				refetchNotes()
				setCurrentView('all')
				setSelectedNoteId(noteId)
			}
		})
	})

	async function loadTagsForNotes(ids: string[]) {
		if (ids.length === 0) return
		const map = await window.electronAPI.fetchTagsForNotes(ids)
		setNoteTagsMap((prev) => ({ ...prev, ...map }))
	}

	// Convert one or more already-read files into notes and open the last one.
	// Imports into the current list when a list view is active (mirroring how a
	// new note is created), otherwise lands in "All Notes".
	async function importFiles(files: ImportedFile[]) {
		if (!files || files.length === 0) return
		const view = currentView()
		const listId = typeof view === 'object' ? view.listId : null

		let lastNote: Note | null = null
		for (const file of files) {
			lastNote = await window.electronAPI.createNote(buildNoteFromFile(file, listId))
		}

		refetchNotes()
		if (listId) {
			bumpListNotes()
		} else {
			setCurrentView('all')
		}
		if (lastNote) setSelectedNoteId(lastNote.id)
	}

	async function importFromDialog() {
		const files = await window.electronAPI.openFileDialog()
		await importFiles(files)
	}

	const [notes, { refetch: refetchNotes }] = createResource(
		noteSort,
		async (sort: NoteSortOrder) => {
			return window.electronAPI.fetchAllNotes(sort)
		}
	)
	const [lists, { refetch: refetchLists }] = createResource(loadLists)
	const [hiddenLists, { refetch: refetchHiddenLists }] = createResource(loadHiddenLists)
	const [tags, { refetch: refetchTags }] = createResource(loadTags)
	const [todos, { refetch: refetchTodos }] = createResource(loadTodos)
	const [todoLists, { refetch: refetchTodoLists }] = createResource(loadTodoLists)

	const [searchResults, { refetch: refetchSearch }] = createResource(
		searchQuery,
		async (query: string) => {
			if (!query.trim()) return []
			return window.electronAPI.searchNotes(query)
		}
	)

	const store: AppStore = {
		currentView,
		setCurrentView,
		selectedNoteId,
		setSelectedNoteId,
		searchQuery,
		setSearchQuery,
		sidebarCollapsed,
		setSidebarCollapsed,
		noteListCollapsed,
		setNoteListCollapsed,
		focusMode,
		setFocusMode,
		commandPaletteOpen,
		setCommandPaletteOpen,
		noteSearchOpen,
		setNoteSearchOpen,
		noteSort,
		setNoteSort,
		showNotePreview,
		setShowNotePreview,
		selectedTodoListId,
		setSelectedTodoListId,

		notes: () => notes(),
		lists: () => lists(),
		hiddenLists: () => hiddenLists(),
		tags: () => tags(),
		todos: () => todos(),
		todoLists: () => todoLists(),
		searchResults: () => searchResults(),
		noteTagsMap,
		loadTagsForNotes,
		refetchNotes: () => refetchNotes(),
		refetchLists: () => refetchLists(),
		refetchHiddenLists: () => refetchHiddenLists(),
		refetchTags: () => refetchTags(),
		refetchTodos: () => refetchTodos(),
		refetchTodoLists: () => refetchTodoLists(),
		refetchSearch: () => refetchSearch(),
		listNotesVersion,
		bumpListNotes,
		notesLoading: () => notes.loading,
		importFromDialog,
		importFiles,
	}

	return (
		<AppStoreContext.Provider value={store}>
			{props.children}
		</AppStoreContext.Provider>
	)
}

export function useAppStore(): AppStore {
	const ctx = useContext(AppStoreContext)
	if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
	return ctx
}
