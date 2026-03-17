import {
	createContext,
	useContext,
	createSignal,
	createResource,
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
	focusMode: () => boolean
	setFocusMode: (v: boolean) => void
	commandPaletteOpen: () => boolean
	setCommandPaletteOpen: (v: boolean) => void
	noteSort: () => NoteSortOrder
	setNoteSort: (sort: NoteSortOrder) => void

	// Data
	notes: () => Note[] | undefined
	lists: () => NoteList[] | undefined
	tags: () => Tag[] | undefined
	todos: () => Todo[] | undefined
	searchResults: () => SearchResult[] | undefined
	refetchNotes: () => void
	refetchLists: () => void
	refetchTags: () => void
	refetchTodos: () => void
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

export function AppStoreProvider(props: ParentProps) {
	const [currentView, setCurrentView] = createSignal<SidebarView>('all')
	const [selectedNoteId, setSelectedNoteId] = createSignal<string | null>(null)
	const [searchQuery, setSearchQuery] = createSignal('')
	const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false)
	const [focusMode, setFocusMode] = createSignal(false)
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false)
	const [noteSort, setNoteSort] = createSignal<NoteSortOrder>('created_at')

	const [notes, { refetch: refetchNotes }] = createResource(
		noteSort,
		async (sort: NoteSortOrder) => {
			return window.electronAPI.fetchAllNotes(sort)
		}
	)
	const [lists, { refetch: refetchLists }] = createResource(loadLists)
	const [tags, { refetch: refetchTags }] = createResource(loadTags)
	const [todos, { refetch: refetchTodos }] = createResource(loadTodos)

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
		focusMode,
		setFocusMode,
		commandPaletteOpen,
		setCommandPaletteOpen,
		noteSort,
		setNoteSort,

		notes: () => notes(),
		lists: () => lists(),
		tags: () => tags(),
		todos: () => todos(),
		searchResults: () => searchResults(),
		refetchNotes: () => refetchNotes(),
		refetchLists: () => refetchLists(),
		refetchTags: () => refetchTags(),
		refetchTodos: () => refetchTodos(),
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
