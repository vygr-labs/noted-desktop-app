import { For, Show, createSignal, createMemo, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { useEditorStore } from '../../stores/editor-store'
import { useSettingsStore } from '../../stores/settings-store'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import {
	FileTextIcon,
	CalendarIcon,
	CheckSquareIcon,
	Trash2Icon,
	SearchIcon,
	PlusIcon,
	FolderIcon,
	SettingsIcon,
	PanelLeftCloseIcon,
	PanelLeftOpenIcon,
	SunIcon,
	DownloadIcon,
	EyeOffIcon,
	EyeIcon,
	ChevronRightIcon,
	LinkIcon,
	Share2Icon,
} from 'lucide-solid'

// ─── Styles ───────────────────────────────────────────────

const container = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	userSelect: 'none',
	minWidth: '220px',
})

const topArea = css({
	px: '3',
	pt: '3',
	pb: '2',
})

const searchBtn = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	width: '100%',
	height: '36px',
	px: '2.5',
	borderRadius: 'md',
	fontSize: '13px',
	cursor: 'pointer',
	color: 'fg.muted',
	bg: 'gray.a2',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const searchKbd = css({
	ml: 'auto',
	fontSize: '10px',
	color: 'fg.subtle',
	fontFamily: 'mono',
	bg: 'gray.a3',
	borderRadius: 'sm',
	px: '1',
	py: '0.5',
	lineHeight: 1,
})

// ─── Navigation ───────────────────────────────────────────

const navSection = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '0.5',
	px: '3',
	py: '1',
})

const navItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	height: '38px',
	px: '2.5',
	borderRadius: 'md',
	fontSize: '13.5px',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.15s ease',
	position: 'relative',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	'&[data-active="true"]': {
		bg: 'indigo.a2',
		color: 'indigo.11',
		fontWeight: '500',
		'& .nav-indicator': {
			opacity: 1,
			transform: 'scaleY(1)',
		},
	},
})

const navIndicator = css({
	position: 'absolute',
	left: 0,
	top: '25%',
	bottom: '25%',
	width: '3px',
	borderRadius: 'full',
	bg: 'indigo.9',
	opacity: 0,
	transform: 'scaleY(0)',
	transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
})

const iconStyle = css({
	width: '4.5',
	height: '4.5',
	flexShrink: 0,
})

const badge = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	minWidth: '18px',
	height: '18px',
	borderRadius: 'full',
	fontSize: '10px',
	fontWeight: '600',
	bg: 'gray.a3',
	color: 'fg.muted',
	px: '1',
	ml: 'auto',
	'&[data-accent="true"]': {
		bg: 'indigo.a3',
		color: 'indigo.11',
	},
})

// ─── Divider ──────────────────────────────────────────────

const divider = css({
	height: '1px',
	bg: 'gray.a3',
	mx: '3',
	my: '1.5',
})

// ─── Lists section ────────────────────────────────────────

const sectionHeader = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: '3',
	pt: '1',
	pb: '0.5',
})

const sectionLabel = css({
	fontSize: '11.5px',
	fontWeight: '600',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.06em',
})

const sectionAddBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '5',
	height: '5',
	borderRadius: 'sm',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const listScroll = css({
	flex: 1,
	overflowY: 'auto',
	overflowX: 'hidden',
	display: 'flex',
	flexDirection: 'column',
	gap: '0.5',
	px: '3',
	py: '0.5',
})

const listItemRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
	'&:hover .list-actions': { opacity: 1 },
})

const listActions = css({
	opacity: 0,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '5',
	height: '5',
	borderRadius: 'sm',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const listName = css({
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
})

const contextMenu = css({
	position: 'fixed',
	zIndex: 100,
	bg: 'gray.2',
	borderRadius: 'md',
	py: '1',
	minWidth: '160px',
	boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25), 0 0 0 1px {colors.gray.a3}',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a3',
	animation: 'fade-in 0.1s ease-out',
})

const contextMenuItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	width: '100%',
	px: '3',
	py: '1.5',
	fontSize: '13px',
	color: 'fg.default',
	cursor: 'pointer',
	transition: 'background 0.1s',
	_hover: { bg: 'gray.a3' },
})

const contextMenuDanger = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	width: '100%',
	px: '3',
	py: '1.5',
	fontSize: '13px',
	color: 'red.11',
	cursor: 'pointer',
	transition: 'background 0.1s',
	_hover: { bg: 'red.a2' },
})

const hiddenHeader = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '2.5',
	py: '1.5',
	fontSize: '11px',
	fontWeight: '600',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	cursor: 'pointer',
	_hover: { color: 'fg.default' },
})

const inlineInput = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	height: '38px',
	px: '2.5',
	mx: '0',
	borderRadius: 'md',
	bg: 'gray.a2',
})

const inlineInputField = css({
	flex: 1,
	bg: 'transparent',
	color: 'fg.default',
	fontSize: '13.5px',
	outline: 'none',
	border: 'none',
	'&::placeholder': { color: 'fg.muted' },
})

// ─── Bottom ───────────────────────────────────────────────

const bottomArea = css({
	px: '3',
	pb: '2',
	pt: '1',
	display: 'flex',
	flexDirection: 'column',
	gap: '0.5',
})

const bottomToolbar = css({
	display: 'flex',
	alignItems: 'center',
	gap: '0.5',
	pt: '1',
})

const toolbarBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '9',
	height: '9',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const smallIcon = css({ width: '4', height: '4' })

const bulkExportMenu = css({
	position: 'absolute',
	bottom: '100%',
	left: 0,
	mb: '1',
	minWidth: '180px',
	py: '1',
	bg: 'bg.default',
	borderRadius: 'lg',
	border: '1px solid',
	borderColor: 'gray.a3',
	boxShadow: '0 8px 24px -4px rgba(0,0,0,0.15)',
	zIndex: 20,
	animation: 'fade-in 0.1s ease',
})

const bulkExportMenuItem = css({
	display: 'flex',
	alignItems: 'center',
	width: '100%',
	px: '3',
	py: '1.5',
	fontSize: '13px',
	color: 'fg.muted',
	cursor: 'pointer',
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const BULK_EXPORT_FORMATS = [
	{ key: 'json', label: 'JSON File' },
	{ key: 'sql', label: 'SQL File' },
	{ key: 'zip', label: 'ZIP Archive' },
]

// ─── Collapsed ────────────────────────────────────────────

const collapsedContainer = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	height: '100%',
	py: '2',
	gap: '0.5',
	userSelect: 'none',
	minWidth: '60px',
})

const collapsedItem = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '40px',
	height: '40px',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.muted',
	position: 'relative',
	transition: 'all 0.15s ease',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	'&[data-active="true"]': {
		bg: 'indigo.a2',
		color: 'indigo.11',
		'& .nav-indicator': {
			opacity: 1,
			transform: 'scaleY(1)',
		},
	},
})

const collapsedIndicator = css({
	position: 'absolute',
	left: '-2px',
	top: '25%',
	bottom: '25%',
	width: '3px',
	borderRadius: 'full',
	bg: 'indigo.9',
	opacity: 0,
	transform: 'scaleY(0)',
	transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
})

const collapsedDivider = css({
	width: '28px',
	height: '1px',
	bg: 'gray.a3',
	my: '1',
})

const collapsedBadge = css({
	position: 'absolute',
	bottom: '-4px',
	right: '-6px',
	fontSize: '9px',
	fontWeight: '700',
	lineHeight: 1,
	minWidth: '14px',
	height: '14px',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	borderRadius: 'full',
	bg: 'indigo.9',
	color: 'white',
	px: '1',
})

// ─── Component ────────────────────────────────────────────

export function Sidebar() {
	const store = useAppStore()
	const editorStore = useEditorStore()
	const settingsStore = useSettingsStore()
	const [showInlineInput, setShowInlineInput] = createSignal(false)
	const [newListName, setNewListName] = createSignal('')
	const [showBulkExport, setShowBulkExport] = createSignal(false)
	const [deleteListConfirm, setDeleteListConfirm] = createSignal<{ id: string; name: string } | null>(null)
	const [listContextMenu, setListContextMenu] = createSignal<{ x: number; y: number; listId: string; hidden: boolean } | null>(null)
	const [showHiddenLists, setShowHiddenLists] = createSignal(false)
	const [showJoinDialog, setShowJoinDialog] = createSignal(false)
	const [joinCode, setJoinCode] = createSignal('')

	async function handleJoin() {
		const code = joinCode().trim()
		if (!code) return
		const noteId = await window.electronAPI.joinSharedNote(code)
		if (noteId) {
			store.refetchNotes()
			store.setCurrentView('all')
			store.setSelectedNoteId(noteId)
			setJoinCode('')
			setShowJoinDialog(false)
		}
	}

	onMount(() => {
		function handleClickOutside(e: MouseEvent) {
			if (showBulkExport()) {
				const target = e.target as HTMLElement
				if (!target.closest('[data-bulk-export]')) {
					setShowBulkExport(false)
				}
			}
			if (listContextMenu()) {
				setListContextMenu(null)
			}
		}
		window.addEventListener('mousedown', handleClickOutside)
		onCleanup(() => window.removeEventListener('mousedown', handleClickOutside))
	})

	const isActive = (view: string) => {
		const current = store.currentView()
		if (typeof current === 'string') return current === view
		return false
	}

	const isListActive = (listId: string) => {
		const current = store.currentView()
		return typeof current === 'object' && current.type === 'list' && current.listId === listId
	}

	const todayCount = createMemo(() => {
		const todayStr = new Date().toISOString().split('T')[0]
		return (store.todos() || []).filter(
			(t) => !t.is_completed && t.due_date && t.due_date === todayStr
		).length
	})

	const todoCount = createMemo(() => {
		return (store.todos() || []).filter((t) => !t.is_completed).length
	})

	const syncedCount = createMemo(() => {
		return (store.notes() || []).filter(n => n.is_shared).length
	})

	function handleNavClick(view: 'all' | 'today' | 'synced' | 'todos' | 'trash' | 'search') {
		store.setCurrentView(view)
		// Only clear editor when switching to non-note views
		if (view === 'todos' || view === 'search') {
			store.setSelectedNoteId(null)
		}
	}

	function handleListClick(listId: string) {
		store.setCurrentView({ type: 'list', listId })
		// Keep the editor open — the note persists across list switches
	}

	function handleListContextMenu(e: MouseEvent, listId: string, hidden: boolean) {
		e.preventDefault()
		e.stopPropagation()
		setListContextMenu({ x: e.clientX, y: e.clientY, listId, hidden })
	}

	function handleDeleteFromMenu() {
		const menu = listContextMenu()
		if (!menu) return
		setListContextMenu(null)
		const allLists = [...(store.lists() || []), ...(store.hiddenLists() || [])]
		const list = allLists.find(l => l.id === menu.listId)
		setDeleteListConfirm({ id: menu.listId, name: list?.name || 'this list' })
	}

	async function handleHideFromMenu() {
		const menu = listContextMenu()
		if (!menu) return
		setListContextMenu(null)
		const currentNote = editorStore.currentNote()
		if (currentNote?.list_id === menu.listId) {
			store.setSelectedNoteId(null)
		}
		await window.electronAPI.hideList(menu.listId)
		store.refetchLists()
		store.refetchHiddenLists()
		store.refetchNotes()
		if (isListActive(menu.listId)) {
			store.setCurrentView('all')
		}
	}

	async function handleUnhideFromMenu() {
		const menu = listContextMenu()
		if (!menu) return
		setListContextMenu(null)
		await window.electronAPI.unhideList(menu.listId)
		store.refetchLists()
		store.refetchHiddenLists()
		store.refetchNotes()
	}

	async function confirmDeleteList() {
		const info = deleteListConfirm()
		if (!info) return
		setDeleteListConfirm(null)
		const currentNote = editorStore.currentNote()
		if (currentNote?.list_id === info.id) {
			store.setSelectedNoteId(null)
		}
		await window.electronAPI.deleteList(info.id)
		store.refetchLists()
		store.refetchHiddenLists()
		store.refetchNotes()
		if (isListActive(info.id)) {
			store.setCurrentView('all')
		}
	}

	async function handleNewNote() {
		const view = store.currentView()
		const listId = typeof view === 'object' ? view.listId : null
		const note = await window.electronAPI.createNote({
			title: 'Untitled',
			list_id: listId,
		})
		store.refetchNotes()
		editorStore.setIsNewNote(true)
		store.setSelectedNoteId(note.id)
	}

	function dismissInlineInput() {
		setShowInlineInput(false)
		setNewListName('')
	}

	async function handleCreateList() {
		const name = newListName().trim()
		if (!name) {
			dismissInlineInput()
			return
		}
		const list = await window.electronAPI.createList(name)
		store.refetchLists()
		dismissInlineInput()
		store.setCurrentView({ type: 'list', listId: list.id })
		store.setSelectedNoteId(null)
	}

	function handleListInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault()
			handleCreateList()
		}
		if (e.key === 'Escape') {
			dismissInlineInput()
		}
	}

	function handleListInputBlur() {
		// Use a timeout so that if Enter was pressed, handleCreateList runs first
		setTimeout(() => {
			if (showInlineInput()) {
				handleCreateList()
			}
		}, 100)
	}

	return (
		<>
		<Show
			when={!store.sidebarCollapsed()}
			fallback={
				/* ─── Collapsed sidebar ──────────────────── */
				<div class={collapsedContainer}>
					<div
						class={collapsedItem}
						data-active={isActive('search')}
						onClick={() => store.setCommandPaletteOpen(true)}
						title="Search (Ctrl+Shift+F)"
					>
						<div class={`nav-indicator ${collapsedIndicator}`} />
						<SearchIcon class={iconStyle} />
					</div>
					<div
						class={collapsedItem}
						data-active={isActive('today')}
						onClick={() => handleNavClick('today')}
						title="Today"
					>
						<div class={`nav-indicator ${collapsedIndicator}`} />
						<CalendarIcon class={iconStyle} />
					</div>
					<div
						class={collapsedItem}
						data-active={isActive('all')}
						onClick={() => handleNavClick('all')}
						title="All Notes"
					>
						<div class={`nav-indicator ${collapsedIndicator}`} />
						<FileTextIcon class={iconStyle} />
					</div>
					<Show when={syncedCount() > 0}>
						<div
							class={collapsedItem}
							data-active={isActive('synced')}
							onClick={() => handleNavClick('synced')}
							title="Synced Notes"
						>
							<div class={`nav-indicator ${collapsedIndicator}`} />
							<Share2Icon class={iconStyle} />
						</div>
					</Show>
					<div
						class={collapsedItem}
						data-active={isActive('todos')}
						onClick={() => handleNavClick('todos')}
						title="To-dos"
					>
						<div class={`nav-indicator ${collapsedIndicator}`} />
						<CheckSquareIcon class={iconStyle} />
					</div>

					{/* Lists */}
					<Show when={store.lists()?.length}>
						<div class={collapsedDivider} />
						<For each={store.lists()}>
							{(list) => {
								const count = createMemo(() =>
									(store.notes() || []).filter(
										(n) => n.list_id === list.id && !n.is_trashed
									).length
								)
								return (
									<div
										class={collapsedItem}
										data-active={isListActive(list.id)}
										onClick={() => handleListClick(list.id)}
										title={list.name}
									>
										<div class={`nav-indicator ${collapsedIndicator}`} />
										<div style={{ position: 'relative', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>
											<FolderIcon class={iconStyle} />
											<Show when={count() > 0}>
												<span class={collapsedBadge}>{count()}</span>
											</Show>
										</div>
									</div>
								)
							}}
						</For>
					</Show>

					<div class={css({ flex: 1 })} />

					<div
						class={collapsedItem}
						data-active={isActive('trash')}
						onClick={() => handleNavClick('trash')}
						title="Trash"
					>
						<div class={`nav-indicator ${collapsedIndicator}`} />
						<Trash2Icon class={iconStyle} />
					</div>

					<div class={collapsedDivider} />

					<div
						class={collapsedItem}
						onClick={handleNewNote}
						title="New Note"
					>
						<PlusIcon class={iconStyle} />
					</div>
					<div
						class={collapsedItem}
						onClick={() => settingsStore.cycleTheme()}
						title={`Theme: ${settingsStore.theme()}`}
					>
						<SunIcon class={iconStyle} />
					</div>
					<div
						class={collapsedItem}
						onClick={() => settingsStore.setShowSettingsDialog(true)}
						title="Settings"
					>
						<SettingsIcon class={iconStyle} />
					</div>
					<div style={{ position: 'relative' }} data-bulk-export>
						<div
							class={collapsedItem}
							onClick={() => setShowBulkExport(!showBulkExport())}
							title="Export all notes"
						>
							<DownloadIcon class={iconStyle} />
						</div>
						<Show when={showBulkExport()}>
							<div class={bulkExportMenu} style={{ left: '100%', bottom: 'auto', top: 0 }}>
								<For each={BULK_EXPORT_FORMATS}>
									{(fmt) => (
										<button
											class={bulkExportMenuItem}
											onClick={() => {
												setShowBulkExport(false)
												window.electronAPI.exportAllNotes(fmt.key)
											}}
										>
											{fmt.label}
										</button>
									)}
								</For>
							</div>
						</Show>
					</div>
					<div
						class={collapsedItem}
						onClick={() => store.setSidebarCollapsed(false)}
						title="Expand sidebar"
					>
						<PanelLeftOpenIcon class={iconStyle} />
					</div>
				</div>
			}
		>
			{/* ─── Expanded sidebar ──────────────────────── */}
			<div class={container}>
				{/* Top — Search */}
				<div class={topArea}>
					<div
						class={searchBtn}
						onClick={() => store.setCommandPaletteOpen(true)}
					>
						<SearchIcon class={css({ width: '3.5', height: '3.5', flexShrink: 0 })} />
						<span>Search</span>
						<span class={searchKbd}>Ctrl+Shift+F</span>
					</div>
				</div>

				{/* Main navigation */}
				<div class={navSection}>
					<div
						class={navItem}
						data-active={isActive('today')}
						onClick={() => handleNavClick('today')}
					>
						<div class={`nav-indicator ${navIndicator}`} />
						<CalendarIcon class={iconStyle} />
						<span>Today</span>
						<Show when={todayCount() > 0}>
							<span class={badge} data-accent="true">{todayCount()}</span>
						</Show>
					</div>
					<div
						class={navItem}
						data-active={isActive('all')}
						onClick={() => handleNavClick('all')}
					>
						<div class={`nav-indicator ${navIndicator}`} />
						<FileTextIcon class={iconStyle} />
						<span>All Notes</span>
						<Show when={(store.notes() || []).length > 0}>
							<span class={badge}>{(store.notes() || []).length}</span>
						</Show>
					</div>
					<Show when={syncedCount() > 0}>
						<div
							class={navItem}
							data-active={isActive('synced')}
							onClick={() => handleNavClick('synced')}
						>
							<div class={`nav-indicator ${navIndicator}`} />
							<Share2Icon class={iconStyle} />
							<span>Synced</span>
							<span class={badge}>{syncedCount()}</span>
						</div>
					</Show>
					<div
						class={navItem}
						data-active={isActive('todos')}
						onClick={() => handleNavClick('todos')}
					>
						<div class={`nav-indicator ${navIndicator}`} />
						<CheckSquareIcon class={iconStyle} />
						<span>To-dos</span>
						<Show when={todoCount() > 0}>
							<span class={badge} data-accent="true">{todoCount()}</span>
						</Show>
					</div>
				</div>

				<div class={divider} />

				{/* Lists */}
				<div class={sectionHeader}>
					<span class={sectionLabel}>Lists</span>
					<button
						class={sectionAddBtn}
						onClick={() => setShowInlineInput(true)}
						title="New list"
					>
						<PlusIcon class={css({ width: '3', height: '3' })} />
					</button>
				</div>
				<div class={listScroll}>
					<For each={store.lists()}>
						{(list) => (
							<div
								class={listItemRow}
								onContextMenu={(e) => handleListContextMenu(e, list.id, false)}
							>
								<div
									class={navItem}
									style={{ flex: 1 }}
									data-active={isListActive(list.id)}
									onClick={() => handleListClick(list.id)}
								>
									<div class={`nav-indicator ${navIndicator}`} />
									<FolderIcon class={iconStyle} />
									<span class={listName}>{list.name}</span>
								</div>
							</div>
						)}
					</For>
					{/* Inline create input */}
					<Show when={showInlineInput()}>
						<div class={inlineInput}>
							<FolderIcon class={iconStyle} style={{ color: 'var(--colors-fg-muted)' }} />
							<input
								ref={(el) => requestAnimationFrame(() => el.focus())}
								class={inlineInputField}
								value={newListName()}
								onInput={(e) => setNewListName(e.currentTarget.value)}
								onKeyDown={handleListInputKeyDown}
								onBlur={handleListInputBlur}
								placeholder="List name..."
							/>
						</div>
					</Show>
				</div>

				{/* Hidden Lists */}
				<Show when={(store.hiddenLists() || []).length > 0}>
					<div
						class={hiddenHeader}
						onClick={() => setShowHiddenLists(!showHiddenLists())}
					>
						<ChevronRightIcon
							class={css({ width: '3', height: '3', transition: 'transform 0.15s' })}
							style={{ transform: showHiddenLists() ? 'rotate(90deg)' : 'rotate(0deg)' }}
						/>
						<span>Hidden ({(store.hiddenLists() || []).length})</span>
					</div>
					<Show when={showHiddenLists()}>
						<div style={{ animation: 'fade-in 0.15s ease' }}>
							<For each={store.hiddenLists()}>
								{(list) => (
									<div
										class={listItemRow}
										onContextMenu={(e) => handleListContextMenu(e, list.id, true)}
									>
										<div
											class={navItem}
											style={{ flex: 1, opacity: 0.6 }}
											data-active={isListActive(list.id)}
											onClick={() => handleListClick(list.id)}
										>
											<div class={`nav-indicator ${navIndicator}`} />
											<EyeOffIcon class={iconStyle} />
											<span class={listName}>{list.name}</span>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</Show>

				{/* Bottom */}
				<div class={divider} />
				<div class={bottomArea}>
					<div
						class={navItem}
						data-active={isActive('trash')}
						onClick={() => handleNavClick('trash')}
					>
						<div class={`nav-indicator ${navIndicator}`} />
						<Trash2Icon class={iconStyle} />
						<span>Trash</span>
					</div>
					<div class={bottomToolbar}>
						<button class={toolbarBtn} onClick={handleNewNote} title="New Note">
							<PlusIcon class={smallIcon} />
						</button>
						<button class={toolbarBtn} onClick={() => setShowJoinDialog(true)} title="Join shared note">
							<LinkIcon class={smallIcon} />
						</button>
						<button
							class={toolbarBtn}
							onClick={() => settingsStore.setShowSettingsDialog(true)}
							title="Settings"
						>
							<SettingsIcon class={smallIcon} />
						</button>
						<div style={{ position: 'relative' }} data-bulk-export>
							<button
								class={toolbarBtn}
								onClick={() => setShowBulkExport(!showBulkExport())}
								title="Export all notes"
							>
								<DownloadIcon class={smallIcon} />
							</button>
							<Show when={showBulkExport()}>
								<div class={bulkExportMenu}>
									<For each={BULK_EXPORT_FORMATS}>
										{(fmt) => (
											<button
												class={bulkExportMenuItem}
												onClick={() => {
													setShowBulkExport(false)
													window.electronAPI.exportAllNotes(fmt.key)
												}}
											>
												{fmt.label}
											</button>
										)}
									</For>
								</div>
							</Show>
						</div>
						<button
							class={toolbarBtn}
							onClick={() => settingsStore.cycleTheme()}
							title={`Theme: ${settingsStore.theme()}`}
						>
							<SunIcon class={smallIcon} />
						</button>
						<div class={css({ flex: 1 })} />
						<button
							class={toolbarBtn}
							onClick={() => store.setSidebarCollapsed(true)}
							title="Collapse sidebar"
						>
							<PanelLeftCloseIcon class={smallIcon} />
						</button>
					</div>
				</div>
			</div>

		</Show>
		<Show when={listContextMenu()}>
			{(menu) => (
				<div
					class={contextMenu}
					style={{ left: `${menu().x}px`, top: `${menu().y}px` }}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<Show when={menu().hidden}>
						<button class={contextMenuItem} onClick={handleUnhideFromMenu}>
							<EyeIcon class={css({ width: '3.5', height: '3.5' })} />
							Show list
						</button>
					</Show>
					<Show when={!menu().hidden}>
						<button class={contextMenuItem} onClick={handleHideFromMenu}>
							<EyeOffIcon class={css({ width: '3.5', height: '3.5' })} />
							Hide list
						</button>
					</Show>
					<button class={contextMenuDanger} onClick={handleDeleteFromMenu}>
						<Trash2Icon class={css({ width: '3.5', height: '3.5' })} />
						Delete list
					</button>
				</div>
			)}
		</Show>
		<ConfirmDialog
			open={!!deleteListConfirm()}
			title="Delete list?"
			description={`"${deleteListConfirm()?.name}" and all its notes will be moved to trash.`}
			confirmLabel="Delete"
			destructive
			onConfirm={confirmDeleteList}
			onCancel={() => setDeleteListConfirm(null)}
		/>
		<Show when={showJoinDialog()}>
			<div
				class={css({ position: 'fixed', inset: 0, bg: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 })}
				onClick={() => setShowJoinDialog(false)}
			>
				<div
					class={css({ bg: 'gray.2', borderRadius: 'lg', p: '6', width: '360px', boxShadow: '0 24px 64px -8px rgba(0, 0, 0, 0.35)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'gray.a3' })}
					onClick={(e) => e.stopPropagation()}
				>
					<div class={css({ fontSize: 'md', fontWeight: 'semibold', mb: '2', color: 'fg.default' })}>Join shared note</div>
					<div class={css({ fontSize: 'sm', color: 'fg.subtle', mb: '4' })}>Paste a share code or link to join a shared note.</div>
					<input
						class={css({ width: '100%', bg: 'gray.a2', border: '1px solid', borderColor: 'gray.a4', borderRadius: 'md', px: '3', py: '2', fontSize: '13px', color: 'fg.default', fontFamily: 'mono', outline: 'none', mb: '4', _focus: { borderColor: 'indigo.8' } })}
						value={joinCode()}
						onInput={(e) => setJoinCode(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleJoin()
							if (e.key === 'Escape') setShowJoinDialog(false)
						}}
						placeholder="Paste share code or link..."
						ref={(el) => requestAnimationFrame(() => el.focus())}
					/>
					<div class={css({ display: 'flex', justifyContent: 'flex-end', gap: '2' })}>
						<button
							class={css({ px: '4', py: '1.5', borderRadius: 'md', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', bg: 'bg.muted', color: 'fg.default', _hover: { bg: 'bg.emphasized' } })}
							onClick={() => setShowJoinDialog(false)}
						>
							Cancel
						</button>
						<button
							class={css({ px: '4', py: '1.5', borderRadius: 'md', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', bg: 'indigo.9', color: 'white', _hover: { bg: 'indigo.10' } })}
							onClick={handleJoin}
						>
							Join
						</button>
					</div>
				</div>
			</div>
		</Show>
		</>
	)
}
