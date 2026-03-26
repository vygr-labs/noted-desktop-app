import { createSignal, createResource, createMemo, For, Show, onMount } from 'solid-js'
import { css } from '../../../styled-system/css'
import {
	PinIcon,
	PinOffIcon,
	XIcon,
	PlusIcon,
	Trash2Icon,
	CalendarIcon,
	GripVerticalIcon,
	FileTextIcon,
} from 'lucide-solid'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { formatDate } from '../../lib/date-utils'

const richExtensions = [
	StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
	TaskList,
	TaskItem.configure({ nested: true }),
	Underline,
	Highlight.configure({ multicolor: false }),
]

// ─── Styles ──────────────────────────────────────────────

const shell = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100vh',
	overflow: 'hidden',
	bg: 'bg.default',
	borderRadius: 'lg',
	userSelect: 'none',
})

const titlebar = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	height: '36px',
	px: '3',
	flexShrink: 0,
	bg: 'gray.a2',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a3',
	cursor: 'grab',
	_active: { cursor: 'grabbing' },
})

const dragHandle = css({
	display: 'flex',
	alignItems: 'center',
	color: 'fg.subtle',
	_hover: { color: 'fg.muted' },
})

const titleText = css({
	flex: 1,
	fontSize: '12px',
	fontWeight: '600',
	color: 'fg.default',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	letterSpacing: '-0.01em',
})

const titleBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '6',
	height: '6',
	borderRadius: 'sm',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	'&[data-active="true"]': { color: 'indigo.11' },
})

const titleIcon = css({ width: '3.5', height: '3.5' })

const body = css({
	flex: 1,
	overflow: 'auto',
	display: 'flex',
	flexDirection: 'column',
})

// ─── Add todo row ────────────────────────────────────────

const addRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '3',
	py: '2',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a2',
	flexShrink: 0,
})

const addInput = css({
	flex: 1,
	bg: 'transparent',
	border: 'none',
	outline: 'none',
	color: 'fg.default',
	fontSize: '12.5px',
	'&::placeholder': { color: 'fg.subtle' },
})

const addBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '6',
	height: '6',
	borderRadius: 'sm',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	transition: 'all 0.15s',
	_hover: { bg: 'indigo.a3', color: 'indigo.11' },
})

// ─── Todo item ───────────────────────────────────────────

const todoItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	px: '3',
	py: '2',
	transition: 'background 0.1s',
	_hover: {
		bg: 'gray.a2',
		'& .popout-delete': { opacity: 1 },
	},
})

const checkbox = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	flexShrink: 0,
	width: '16px',
	height: '16px',
	borderRadius: 'full',
	borderWidth: '2px',
	borderStyle: 'solid',
	borderColor: 'gray.a5',
	cursor: 'pointer',
	transition: 'all 0.15s',
	_hover: { borderColor: 'indigo.8' },
	'&[data-checked="true"]': {
		bg: 'indigo.9',
		borderColor: 'indigo.9',
	},
})

const checkSvg = css({
	width: '8px',
	height: '8px',
	color: 'white',
	opacity: 0,
	transform: 'scale(0)',
	transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
	'[data-checked="true"] &': {
		opacity: 1,
		transform: 'scale(1)',
	},
})

const todoContent = css({
	flex: 1,
	minWidth: 0,
})

const todoText = css({
	fontSize: '12.5px',
	color: 'fg.default',
	lineHeight: '1.4',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	transition: 'all 0.2s',
	'&[data-done="true"]': {
		textDecoration: 'line-through',
		textDecorationColor: 'fg.subtle',
		color: 'fg.muted',
	},
})

const todoDue = css({
	display: 'flex',
	alignItems: 'center',
	gap: '0.5',
	fontSize: '10px',
	color: 'fg.subtle',
	mt: '0.5',
	'&[data-overdue="true"]': { color: 'red.9' },
})

const todoDelete = css({
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
	_hover: { color: 'red.11' },
})

// ─── Note item ───────────────────────────────────────────

const noteItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	px: '3',
	py: '2.5',
	cursor: 'default',
	transition: 'background 0.1s',
	_hover: { bg: 'gray.a2' },
})

const noteIcon = css({
	width: '3.5',
	height: '3.5',
	color: 'fg.subtle',
	flexShrink: 0,
})

const noteTitle = css({
	flex: 1,
	fontSize: '12.5px',
	color: 'fg.default',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	lineHeight: '1.4',
})

const noteDate = css({
	fontSize: '10px',
	color: 'fg.subtle',
	flexShrink: 0,
})

// ─── Single note view ────────────────────────────────────

const noteViewContent = css({
	flex: 1,
	overflow: 'auto',
	px: '4',
	py: '3',
	// can remove later
	fontSize: '13px !important',
	color: 'fg.default',
	lineHeight: '1.7',
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
})

// ─── Footer ──────────────────────────────────────────────

const footer = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: '3',
	py: '2',
	borderTop: '1px solid',
	borderTopColor: 'gray.a2',
	fontSize: '10.5px',
	color: 'fg.subtle',
	flexShrink: 0,
})

// ─── Component ───────────────────────────────────────────

export default function PopoutView() {
	const params = new URLSearchParams(window.location.search)
	const view = params.get('view') || 'todos'
	const listId = params.get('listId') || null
	const title = params.get('title') || (view === 'note' ? 'Note' : view === 'notes' ? 'Notes' : 'To-dos')

	const isTodos = view === 'todos'
	const isSingleNote = view === 'note'

	const [isPinned, setIsPinned] = createSignal(false)
	const [newText, setNewText] = createSignal('')

	// ── Todos data ──
	const [todos, { refetch: refetchTodos }] = createResource(
		() => isTodos,
		async (enabled) => (enabled ? window.electronAPI.fetchAllTodos() : [])
	)

	// ── Single note data ──
	const [singleNote, { refetch: refetchNote }] = createResource(
		() => isSingleNote ? listId : null,
		async (noteId) => (noteId ? window.electronAPI.fetchNote(noteId) : undefined)
	)

	// ── Notes list data ──
	const [notes, { refetch: refetchNotes }] = createResource(
		() => view === 'notes',
		async (enabled) => {
			if (!enabled) return []
			if (listId) return window.electronAPI.fetchNotesByList(listId)
			return window.electronAPI.fetchAllNotes()
		}
	)

	onMount(async () => {
		// Apply the saved theme
		const theme = await window.electronAPI.getSetting('appTheme')
		const html = document.documentElement
		html.removeAttribute('data-theme')
		if (theme === 'warm' || theme === 'slate') {
			html.setAttribute('data-theme', theme)
		}
		if (theme === 'dark') {
			window.electronAPI.darkModeUpdate('dark')
		} else if (theme === 'light' || theme === 'warm' || theme === 'slate') {
			window.electronAPI.darkModeUpdate('light')
		} else {
			window.electronAPI.darkModeSystem()
		}

		window.electronAPI.onPopoutTodosChanged(() => {
			if (isTodos) refetchTodos()
			else if (isSingleNote) refetchNote()
			else refetchNotes()
		})
		window.electronAPI.popoutIsPinned().then(setIsPinned)
	})

	// ── Todos helpers ──
	const filteredTodos = () => {
		const all = todos() || []
		if (listId) return all.filter((t) => t.todo_list_id === listId)
		return all
	}
	const activeTodos = () => filteredTodos().filter((t) => !t.is_completed)
	const completedTodos = () => filteredTodos().filter((t) => !!t.is_completed)

	const isOverdue = (todo: Todo) => {
		if (!todo.due_date || todo.is_completed) return false
		return todo.due_date < new Date().toISOString().split('T')[0]
	}

	async function handleToggle(todo: Todo) {
		await window.electronAPI.updateTodo(todo.id, { is_completed: !todo.is_completed })
		refetchTodos()
	}

	async function handleDeleteTodo(todo: Todo) {
		await window.electronAPI.deleteTodo(todo.id)
		refetchTodos()
	}

	async function handleAddTodo() {
		const text = newText().trim()
		if (!text) return
		await window.electronAPI.createTodo({
			text,
			due_date: new Date().toISOString().split('T')[0],
			todo_list_id: listId,
		})
		setNewText('')
		refetchTodos()
	}

	// ── Notes helpers ──
	const displayNotes = () => (notes() || []).filter((n) => !n.is_trashed)

	// ── Shared ──
	async function togglePin() {
		const pinned = await window.electronAPI.popoutTogglePin()
		setIsPinned(pinned)
	}

	function closeWindow() {
		window.electronAPI.popoutClose()
	}

	// ── Single note HTML ──
	const noteHtml = createMemo(() => {
		const note = singleNote()
		if (!note) return ''
		if (note.note_type === 'rich' && note.content) {
			try {
				const json = JSON.parse(note.content)
				return generateHTML(json, richExtensions)
			} catch {
				return note.content_plain || note.content || ''
			}
		}
		return ''
	})

	const isPlainNote = () => singleNote()?.note_type === 'plain'

	// ── Renderers ──
	function renderTodo(todo: Todo) {
		return (
			<div class={todoItem}>
				<div
					class={checkbox}
					data-checked={!!todo.is_completed}
					onClick={() => handleToggle(todo)}
				>
					<svg class={checkSvg} viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M2.5 6.5L5 9L9.5 3.5" />
					</svg>
				</div>
				<div class={todoContent}>
					<div class={todoText} data-done={!!todo.is_completed}>{todo.text}</div>
					<Show when={todo.due_date}>
						<div class={todoDue} data-overdue={isOverdue(todo)}>
							<CalendarIcon class={css({ width: '2.5', height: '2.5' })} />
							{formatDate(todo.due_date!)}
						</div>
					</Show>
				</div>
				<div class={`popout-delete ${todoDelete}`} onClick={() => handleDeleteTodo(todo)}>
					<Trash2Icon class={css({ width: '3', height: '3' })} />
				</div>
			</div>
		)
	}

	function renderNote(note: Note) {
		return (
			<div class={noteItem}>
				<FileTextIcon class={noteIcon} />
				<span class={noteTitle}>{note.title || 'Untitled'}</span>
				<span class={noteDate}>{formatDate(note.updated_at)}</span>
			</div>
		)
	}

	return (
		<div class={shell}>
			{/* Titlebar */}
			<div class={titlebar} style={{ '-webkit-app-region': 'drag' }}>
				<div class={dragHandle}>
					<GripVerticalIcon class={css({ width: '3', height: '3' })} />
				</div>
				<span class={titleText}>{title}</span>
				<div style={{ '-webkit-app-region': 'no-drag', display: 'flex', gap: '2px' }}>
					<button
						class={titleBtn}
						data-active={isPinned()}
						onClick={togglePin}
						title={isPinned() ? 'Unpin from top' : 'Pin on top'}
					>
						<Show when={isPinned()} fallback={<PinIcon class={titleIcon} />}>
							<PinOffIcon class={titleIcon} />
						</Show>
					</button>
					<button class={titleBtn} onClick={closeWindow} title="Close">
						<XIcon class={titleIcon} />
					</button>
				</div>
			</div>

			{/* Add todo (only for todos view) */}
			<Show when={isTodos}>
				<div class={addRow}>
					<input
						class={addInput}
						value={newText()}
						onInput={(e) => setNewText(e.currentTarget.value)}
						onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo() }}
						placeholder="Add a task..."
					/>
					<button class={addBtn} onClick={handleAddTodo} title="Add">
						<PlusIcon class={css({ width: '3.5', height: '3.5' })} />
					</button>
				</div>
			</Show>

			{/* Body */}
			<Show when={isSingleNote} fallback={
				<div class={body}>
					<Show when={isTodos} fallback={
						<For each={displayNotes()}>
							{(note) => renderNote(note)}
						</For>
					}>
						<For each={activeTodos()}>
							{(todo) => renderTodo(todo)}
						</For>
						<Show when={completedTodos().length > 0}>
							<div class={css({ px: '3', pt: '2', pb: '1' })}>
								<span class={css({ fontSize: '10px', fontWeight: '600', color: 'fg.subtle', textTransform: 'uppercase', letterSpacing: '0.05em' })}>
									Completed
								</span>
							</div>
							<For each={completedTodos()}>
								{(todo) => renderTodo(todo)}
							</For>
						</Show>
					</Show>
				</div>
			}>
				<div class={noteViewContent}>
					<Show when={isPlainNote()} fallback={
						<div class="tiptap popup" innerHTML={noteHtml()} />
					}>
						<pre style={{
							'white-space': 'pre-wrap',
							'word-break': 'break-word',
							'font-family': 'inherit',
							'font-size': '0.9375rem',
							'line-height': '1.8',
							color: 'var(--colors-fg-default)',
							margin: '0',
						}}>
							{singleNote()?.content_plain || singleNote()?.content || 'Empty note'}
						</pre>
					</Show>
				</div>
			</Show>

			{/* Footer */}
			<div class={footer}>
				<Show when={isSingleNote} fallback={
					<Show when={isTodos} fallback={
						<span>{displayNotes().length} {displayNotes().length === 1 ? 'note' : 'notes'}</span>
					}>
						<span>{activeTodos().length} remaining</span>
						<span>{completedTodos().length} done</span>
					</Show>
				}>
					<span>{formatDate(singleNote()?.updated_at || '')}</span>
				</Show>
			</div>
		</div>
	)
}
