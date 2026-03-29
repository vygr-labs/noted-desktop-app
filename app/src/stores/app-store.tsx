import {
	createContext,
	useContext,
	createSignal,
	createResource,
	onMount,
	type ParentProps,
} from 'solid-js'

type SidebarView =
	| 'all'
	| 'today'
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

	// Data
	notes: () => Note[] | undefined
	lists: () => NoteList[] | undefined
	tags: () => Tag[] | undefined
	todos: () => Todo[] | undefined
	todoLists: () => TodoListItem[] | undefined
	searchResults: () => SearchResult[] | undefined
	noteTagsMap: () => Record<string, Tag[]>
	loadTagsForNotes: (ids: string[]) => void
	refetchNotes: () => void
	refetchLists: () => void
	refetchTags: () => void
	refetchTodos: () => void
	refetchTodoLists: () => void
	refetchSearch: () => void
	notesLoading: () => boolean
}

const AppStoreContext = createContext<AppStore>()

async function loadLists(): Promise<NoteList[]> {
	return window.electronAPI.fetchAllLists()
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
	const [noteTagsMap, setNoteTagsMap] = createSignal<Record<string, Tag[]>>({})

	// Persist sort preference
	function setNoteSort(sort: NoteSortOrder) {
		_setNoteSort(sort)
		window.electronAPI.setSetting('noteSort', sort)
	}

	// Load saved sort on startup + listen for cross-window todo changes
	onMount(async () => {
		const saved = await window.electronAPI.getSetting('noteSort')
		if (saved === 'updated_at' || saved === 'created_at' || saved === 'title') {
			_setNoteSort(saved)
		}

		window.electronAPI.onPopoutTodosChanged(() => {
			refetchTodos()
		})

		window.electronAPI.onNotesRefresh(() => {
			refetchNotes()
		})
	})

	async function loadTagsForNotes(ids: string[]) {
		if (ids.length === 0) return
		const map = await window.electronAPI.fetchTagsForNotes(ids)
		setNoteTagsMap((prev) => ({ ...prev, ...map }))
	}

	const [notes, { refetch: refetchNotes }] = createResource(
		noteSort,
		async (sort: NoteSortOrder) => {
			return window.electronAPI.fetchAllNotes(sort)
		}
	)
	const [lists, { refetch: refetchLists }] = createResource(loadLists)
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

		notes: () => notes(),
		lists: () => lists(),
		tags: () => tags(),
		todos: () => todos(),
		todoLists: () => todoLists(),
		searchResults: () => searchResults(),
		noteTagsMap,
		loadTagsForNotes,
		refetchNotes: () => refetchNotes(),
		refetchLists: () => refetchLists(),
		refetchTags: () => refetchTags(),
		refetchTodos: () => refetchTodos(),
		refetchTodoLists: () => refetchTodoLists(),
		refetchSearch: () => refetchSearch(),
		notesLoading: () => notes.loading,
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
