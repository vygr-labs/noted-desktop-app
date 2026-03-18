import { For, Show, createSignal, createMemo } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { useEditorStore } from '../../stores/editor-store'
import { useSettingsStore } from '../../stores/settings-store'
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

// ─── Component ────────────────────────────────────────────

export function Sidebar() {
	const store = useAppStore()
	const editorStore = useEditorStore()
	const settingsStore = useSettingsStore()
	const [showInlineInput, setShowInlineInput] = createSignal(false)
	const [newListName, setNewListName] = createSignal('')

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

	function handleNavClick(view: 'all' | 'today' | 'todos' | 'trash' | 'search') {
		store.setCurrentView(view)
		store.setSelectedNoteId(null)
	}

	function handleListClick(listId: string) {
		store.setCurrentView({ type: 'list', listId })
		store.setSelectedNoteId(null)
	}

	async function handleDeleteList(e: Event, listId: string) {
		e.stopPropagation()
		await window.electronAPI.deleteList(listId)
		store.refetchLists()
		if (isListActive(listId)) {
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
					<div
						class={collapsedItem}
						data-active={isActive('todos')}
						onClick={() => handleNavClick('todos')}
						title="To-dos"
					>
						<div class={`nav-indicator ${collapsedIndicator}`} />
						<CheckSquareIcon class={iconStyle} />
					</div>

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
							<div class={listItemRow}>
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
								<div
									class={`list-actions ${listActions}`}
									onClick={(e) => handleDeleteList(e, list.id)}
									title="Delete list"
								>
									<Trash2Icon class={css({ width: '3', height: '3' })} />
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
						<button
							class={toolbarBtn}
							onClick={() => settingsStore.setShowSettingsDialog(true)}
							title="Settings"
						>
							<SettingsIcon class={smallIcon} />
						</button>
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
							title="Collapse sidebar (Ctrl+B)"
						>
							<PanelLeftCloseIcon class={smallIcon} />
						</button>
					</div>
				</div>
			</div>
		</Show>
	)
}
