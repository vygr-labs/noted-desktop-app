import { createMemo, For, Show, createSignal, createEffect, on, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { useSyncStore } from '../../stores/sync-store'
import { TodoListSync } from '../../lib/todo-sync'
import { TodoItem } from './TodoItem'
import { TodoList } from './TodoList'
import { getTodayDate, isOverdue, isToday } from '../../lib/date-utils'
import { EmptyState } from '../shared/EmptyState'
import {
	CircleCheckBigIcon,
	PlusIcon,
	XIcon,
	SparklesIcon,
	ExternalLinkIcon,
	Share2Icon,
	UnlinkIcon,
	LoaderIcon,
} from 'lucide-solid'

const container = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'auto',
	animation: 'fade-in 0.2s ease-out',
	bg: 'bg.default',
})

const contentWrap = css({
	maxWidth: '660px',
	width: '100%',
	mx: 'auto',
	px: '10',
	py: '8',
	display: 'flex',
	flexDirection: 'column',
	minHeight: '100%',
})

const activeTodosSection = css({})

const completedSection = css({
	mt: 'auto',
	pt: '4',
	borderTop: '1px solid',
	borderTopColor: 'gray.a2',
})

// ── Header ──

const headerRow = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	mb: '1',
})

const headerTitle = css({
	fontSize: '26px',
	fontWeight: '700',
	color: 'fg.default',
	letterSpacing: '-0.03em',
})

const headerStats = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
})

const statChip = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	px: '3',
	py: '1',
	borderRadius: 'full',
	fontSize: '12px',
	fontWeight: '600',
	bg: 'gray.a2',
	color: 'fg.subtle',
})

const statDot = css({
	width: '6px',
	height: '6px',
	borderRadius: 'full',
})

const headerSubtext = css({
	fontSize: '14px',
	color: 'fg.muted',
	mb: '5',
	letterSpacing: '-0.01em',
})

// ── Tab bar ──

const tabBar = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	mb: '6',
	flexWrap: 'wrap',
	pb: '5',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a2',
})

const tab = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	px: '3.5',
	py: '2',
	borderRadius: 'md',
	fontSize: '13px',
	fontWeight: '500',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.18s ease',
	_hover: { bg: 'gray.a2', color: 'fg.default' },
	'&[data-active="true"]': {
		bg: 'indigo.a2',
		color: 'indigo.11',
		fontWeight: '600',
	},
})

const tabCount = css({
	fontSize: '11px',
	fontWeight: '600',
	color: 'fg.subtle',
	bg: 'gray.a3',
	borderRadius: 'full',
	px: '1.5',
	minWidth: '20px',
	textAlign: 'center',
	lineHeight: '18px',
	'[data-active="true"] &': {
		bg: 'indigo.a3',
		color: 'indigo.11',
	},
})

const tabDot = css({
	width: '8px',
	height: '8px',
	borderRadius: 'full',
	flexShrink: 0,
})

const addTabBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '8',
	height: '8',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	borderWidth: '1px',
	borderStyle: 'dashed',
	borderColor: 'gray.a4',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a2', color: 'fg.default', borderColor: 'gray.a6' },
})

const tabInputWrap = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
})

const tabInput = css({
	fontSize: '13px',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'indigo.a5',
	borderRadius: 'md',
	px: '3.5',
	py: '1.5',
	bg: 'bg.default',
	color: 'fg.default',
	outline: 'none',
	width: '130px',
	_focus: { borderColor: 'indigo.9', boxShadow: '0 0 0 3px {colors.indigo.a2}' },
})

const deleteTabBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '5',
	height: '5',
	borderRadius: 'full',
	cursor: 'pointer',
	color: 'fg.subtle',
	opacity: 0,
	transition: 'all 0.12s',
	_hover: { bg: 'red.a2', color: 'red.11' },
	'[data-active="true"] &, :hover > &': {
		opacity: 1,
	},
})

// ── Progress ──

const progressCard = css({
	display: 'flex',
	alignItems: 'center',
	gap: '4',
	mb: '3',
	px: '5',
	py: '4',
	borderRadius: 'md',
	bg: 'gray.a2',
})

const progressRing = css({
	position: 'relative',
	width: '48px',
	height: '48px',
	flexShrink: 0,
})

const progressRingText = css({
	position: 'absolute',
	inset: 0,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	fontSize: '12px',
	fontWeight: '700',
	color: 'fg.default',
})

const progressInfo = css({
	flex: 1,
})

const progressTitle = css({
	fontSize: '14px',
	fontWeight: '600',
	color: 'fg.default',
	mb: '0.5',
})

const progressSubtext = css({
	fontSize: '12px',
	color: 'fg.muted',
})

// ── Add input ──

const addRow = css({
	display: 'flex',
	gap: '2.5',
	mb: '6',
})

const addInputWrap = css({
	flex: 1,
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	px: '4',
	py: '3',
	borderRadius: 'md',
	bg: 'gray.a2',
	transition: 'all 0.2s ease',
	'&:focus-within': {
		bg: 'bg.default',
		boxShadow: '0 0 0 2px var(--colors-indigo-a4)',
	},
})

const addCircle = css({
	width: '20px',
	height: '20px',
	borderRadius: 'full',
	borderWidth: '2px',
	borderStyle: 'dashed',
	borderColor: 'gray.a5',
	flexShrink: 0,
})

const addInput = css({
	flex: 1,
	bg: 'transparent',
	color: 'fg.default',
	fontSize: '14px',
	outline: 'none',
	border: 'none',
	letterSpacing: '-0.01em',
	'&::placeholder': { color: 'fg.muted' },
})

const addBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	px: '5',
	py: '3',
	borderRadius: 'sm',
	fontSize: '14px',
	fontWeight: '600',
	cursor: 'pointer',
	bg: 'indigo.9',
	color: 'white',
	gap: '1.5',
	transition: 'all 0.18s ease',
	_hover: { bg: 'indigo.10', transform: 'translateY(-1px)', boxShadow: '0 6px 16px -4px {colors.indigo.a5}' },
	_active: { transform: 'translateY(0)' },
})

// ── Ring SVG helper ──

function ProgressRingSVG(props: { pct: number }) {
	const r = 19
	const c = 2 * Math.PI * r
	const offset = () => c - (props.pct / 100) * c

	return (
		<svg width="48" height="48" viewBox="0 0 48 48">
			<circle cx="24" cy="24" r={r} fill="none" stroke="var(--colors-gray-a3)" stroke-width="4" />
			<circle
				cx="24"
				cy="24"
				r={r}
				fill="none"
				stroke="var(--colors-indigo-9)"
				stroke-width="4"
				stroke-linecap="round"
				stroke-dasharray={c}
				stroke-dashoffset={offset()}
				transform="rotate(-90 24 24)"
				style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
			/>
		</svg>
	)
}

export function TodoView() {
	const store = useAppStore()
	const syncStore = useSyncStore()
	const [newTodoText, setNewTodoText] = createSignal('')
	const [selectedListId, setSelectedListId] = createSignal<string | null>(null)
	const [showNewList, setShowNewList] = createSignal(false)
	const [newListName, setNewListName] = createSignal('')
	const [syncLoading, setSyncLoading] = createSignal(false)

	const allTodos = () => store.todos() || []
	const allTodoLists = () => store.todoLists() || []
	let dragTodoId: string | null = null
	let activeTodoSync: TodoListSync | null = null

	// Get the currently selected list object
	const selectedList = createMemo(() => {
		const id = selectedListId()
		if (!id) return null
		return allTodoLists().find(l => l.id === id) || null
	})

	// Connect/disconnect todo sync when selected list changes
	createEffect(on(selectedListId, (listId) => {
		// Cleanup previous sync
		if (activeTodoSync) {
			activeTodoSync.destroy()
			activeTodoSync = null
		}
		setSyncLoading(false)

		if (!listId) return

		// Find the list to check if it's shared
		const list = allTodoLists().find(l => l.id === listId)
		if (!list?.sync_id || !list?.sync_secret) return

		// Show loading if this is a joined list with no local data
		const localTodos = allTodos().filter(t => t.todo_list_id === listId)
		if (localTodos.length === 0) setSyncLoading(true)

		// Connect to the Yjs doc for this shared list
		const managed = syncStore.getDoc(list.sync_id, list.sync_secret)
		activeTodoSync = new TodoListSync(managed.ydoc, listId, () => {
			// Called when remote changes arrive — refetch todos
			setSyncLoading(false)
			store.refetchTodos()
		})

		// Seed Yjs with local todos if Yjs is empty
		if (activeTodoSync.isEmpty()) {
			if (localTodos.length > 0) {
				activeTodoSync.pushLocal(localTodos)
			}
		} else {
			// Yjs has data — apply remote state to local
			const remoteTodos = activeTodoSync.getRemoteTodos()
			if (remoteTodos.length > 0) {
				window.electronAPI.syncTodosFromRemote(listId, remoteTodos).then(() => {
					setSyncLoading(false)
					store.refetchTodos()
				})
			}
		}
	}))

	onCleanup(() => {
		if (activeTodoSync) {
			// Release the Yjs doc back to the sync store (starts idle timer)
			const list = selectedList()
			if (list?.sync_id) syncStore.releaseDoc(list.sync_id)
			activeTodoSync.destroy()
			activeTodoSync = null
		}
	})

	// Push local state to Yjs after any todo mutation
	function pushToSync() {
		if (!activeTodoSync) return
		const listId = selectedListId()
		if (!listId) return
		const todos = allTodos().filter(t => t.todo_list_id === listId)
		activeTodoSync.pushLocal(todos)
	}

	// Auto-push to sync whenever todos change (catches all mutations from TodoItem too)
	createEffect(on(
		() => allTodos(),
		() => pushToSync(),
		{ defer: true }
	))

	function makeDragHandlers(todos: () => Todo[]) {
		return {
			onDragStart: (todoId: string) => (e: DragEvent) => {
				dragTodoId = todoId
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move'
					e.dataTransfer.setData('text/plain', todoId)
				}
			},
			onDragOver: (e: DragEvent) => {
				e.preventDefault()
				if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
			},
			onDrop: (targetId: string) => async (e: DragEvent) => {
				e.preventDefault()
				if (!dragTodoId || dragTodoId === targetId) return
				const list = todos()
				const ids = list.map(t => t.id)
				const fromIdx = ids.indexOf(dragTodoId)
				const toIdx = ids.indexOf(targetId)
				if (fromIdx === -1 || toIdx === -1) return
				ids.splice(fromIdx, 1)
				ids.splice(toIdx, 0, dragTodoId)
				await window.electronAPI.reorderTodos(ids)
				store.refetchTodos()
			},
			onDragEnd: () => { dragTodoId = null },
		}
	}

	// Filter todos by selected list
	const filteredTodos = createMemo(() => {
		const listId = selectedListId()
		if (listId === null) return allTodos()
		return allTodos().filter((t) => t.todo_list_id === listId)
	})

	const overdue = createMemo(() =>
		filteredTodos().filter(
			(t) => !t.is_completed && t.due_date && isOverdue(t.due_date)
		)
	)

	const today = createMemo(() =>
		filteredTodos().filter(
			(t) => !t.is_completed && t.due_date && isToday(t.due_date)
		)
	)

	const upcoming = createMemo(() => {
		const todayStr = getTodayDate()
		return filteredTodos().filter(
			(t) => !t.is_completed && t.due_date && t.due_date > todayStr
		)
	})

	const noDueDate = createMemo(() =>
		filteredTodos().filter((t) => !t.is_completed && !t.due_date)
	)

	const completed = createMemo(() =>
		filteredTodos().filter((t) => t.is_completed)
	)

	const activeCount = () => filteredTodos().length - completed().length
	const totalCount = () => filteredTodos().length
	const completedCount = () => completed().length
	const progressPct = () => {
		if (totalCount() === 0) return 0
		return Math.round((completedCount() / totalCount()) * 100)
	}

	const countForList = (listId: string | null) => {
		if (listId === null) return allTodos().filter((t) => !t.is_completed).length
		return allTodos().filter((t) => t.todo_list_id === listId && !t.is_completed).length
	}

	async function handleAddTodo() {
		const text = newTodoText().trim()
		if (!text) return
		await window.electronAPI.createTodo({
			text,
			due_date: getTodayDate(),
			todo_list_id: selectedListId(),
		})
		setNewTodoText('')
		await store.refetchTodos()
		pushToSync()
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAddTodo()
	}

	async function handleCreateList() {
		const name = newListName().trim()
		if (!name) {
			setShowNewList(false)
			return
		}
		const list = await window.electronAPI.createTodoList(name)
		store.refetchTodoLists()
		setSelectedListId(list.id)
		setNewListName('')
		setShowNewList(false)
	}

	function handleListInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleCreateList()
		if (e.key === 'Escape') {
			setShowNewList(false)
			setNewListName('')
		}
	}

	async function handleDeleteList(listId: string) {
		await window.electronAPI.deleteTodoList(listId)
		store.refetchTodoLists()
		if (selectedListId() === listId) {
			setSelectedListId(null)
		}
	}

	const [todoListShareCode, setTodoListShareCode] = createSignal('')

	async function handleShareTodoList(e: Event, list: TodoListItem) {
		e.stopPropagation()
		if (list.is_shared && list.sync_id && list.sync_secret) {
			const code = `t:${list.sync_id}.${list.sync_secret}`
			navigator.clipboard.writeText(code)
			setTodoListShareCode(code)
			return
		}
		const code = await window.electronAPI.shareTodoList(list.id)
		if (code) {
			navigator.clipboard.writeText(code)
			setTodoListShareCode(code)
			store.refetchTodoLists()
		}
	}

	async function handleUnshareTodoList(e: Event, listId: string) {
		e.stopPropagation()
		await window.electronAPI.unshareTodoList(listId)
		store.refetchTodoLists()
	}

	const hasTodos = () => filteredTodos().length > 0

	const progressMessage = () => {
		const pct = progressPct()
		if (pct === 100) return 'All done! Time to celebrate.'
		if (pct >= 75) return 'Almost there, keep it up!'
		if (pct >= 50) return 'Halfway through, nice progress.'
		if (pct > 0) return "You're getting started, keep going!"
		return `${activeCount()} ${activeCount() === 1 ? 'task' : 'tasks'} waiting for you.`
	}

	return (
		<div class={container}>
			<div class={contentWrap}>
				{/* Header */}
				<div class={headerRow}>
					<h1 class={headerTitle}>To-dos</h1>
					<div class={headerStats}>
						<button
							class={css({
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: '8',
								height: '8',
								borderRadius: 'md',
								cursor: 'pointer',
								color: 'fg.subtle',
								transition: 'all 0.15s',
								_hover: { bg: 'gray.a3', color: 'fg.default' },
							})}
							onClick={() => {
								const listName = selectedListId()
									? allTodoLists().find((l) => l.id === selectedListId())?.name
									: undefined
								window.electronAPI.openPopout({
									view: 'todos',
									listId: selectedListId() || undefined,
									title: listName ? `To-dos · ${listName}` : 'To-dos',
								})
							}}
							title="Pop out to mini window"
						>
							<ExternalLinkIcon class={css({ width: '4', height: '4' })} />
						</button>
						<Show when={hasTodos()}>
							<div class={statChip}>
								<div class={statDot} style={{ background: 'var(--colors-indigo-9)' }} />
								{activeCount()} active
							</div>
							<div class={statChip}>
								<div class={statDot} style={{ background: 'var(--colors-green-9)' }} />
								{completedCount()} done
							</div>
						</Show>
					</div>
				</div>
				<p class={headerSubtext}>{progressMessage()}</p>

				{/* Tab bar */}
				<div class={tabBar}>
					<div
						class={tab}
						data-active={selectedListId() === null}
						onClick={() => setSelectedListId(null)}
					>
						All
						<span class={tabCount}>
							{countForList(null)}
						</span>
					</div>
					<For each={allTodoLists()}>
						{(list) => (
							<div
								class={tab}
								data-active={selectedListId() === list.id}
								onClick={() => setSelectedListId(list.id)}
							>
								<div
									class={tabDot}
									style={{ background: `var(--colors-${list.color}-9)` }}
								/>
								{list.name}
								<span class={tabCount}>
									{countForList(list.id)}
								</span>
								<Show when={!list.is_shared}>
								<div
									class={deleteTabBtn}
									onClick={(e) => handleShareTodoList(e, list)}
									title="Share list"
								>
									<Share2Icon class={css({ width: '3', height: '3' })} />
								</div>
							</Show>
							<Show when={list.is_shared}>
								<div
									class={deleteTabBtn}
									style={{ color: 'var(--colors-indigo-11)', opacity: '0.8' }}
									onClick={(e) => handleShareTodoList(e, list)}
									title="Copy share code"
								>
									<Share2Icon class={css({ width: '3', height: '3' })} />
								</div>
								<div
									class={deleteTabBtn}
									onClick={(e) => handleUnshareTodoList(e, list.id)}
									title="Stop sharing"
								>
									<UnlinkIcon class={css({ width: '3', height: '3' })} />
								</div>
							</Show>
							<div
								class={deleteTabBtn}
								onClick={(e) => {
									e.stopPropagation()
									handleDeleteList(list.id)
								}}
								title={`Delete "${list.name}"`}
							>
								<XIcon class={css({ width: '3', height: '3' })} />
							</div>
							</div>
						)}
					</For>
					<Show
						when={showNewList()}
						fallback={
							<button
								class={addTabBtn}
								onClick={() => setShowNewList(true)}
								title="New list"
							>
								<PlusIcon class={css({ width: '4', height: '4' })} />
							</button>
						}
					>
						<div class={tabInputWrap}>
							<input
								class={tabInput}
								value={newListName()}
								onInput={(e) => setNewListName(e.currentTarget.value)}
								onKeyDown={handleListInputKeyDown}
								onBlur={handleCreateList}
								placeholder="List name"
								autofocus
							/>
						</div>
					</Show>
				</div>

				{/* Add todo */}
				<div class={addRow}>
					<div class={addInputWrap}>
						<div class={addCircle} />
						<input
							class={addInput}
							value={newTodoText()}
							onInput={(e) => setNewTodoText(e.currentTarget.value)}
							onKeyDown={handleKeyDown}
							placeholder="What needs to be done?"
						/>
					</div>
					<button class={addBtn} onClick={handleAddTodo}>
						<PlusIcon class={css({ width: '4', height: '4' })} />
						Add
					</button>
				</div>

				{/* Todo sections */}
				<Show when={syncLoading()}>
					<div class={css({
						display: 'flex', flexDirection: 'column', gap: '3',
						py: '4', animation: 'pulse 1.5s ease-in-out infinite',
					})}>
						<div class={css({ height: '14px', bg: 'gray.a3', borderRadius: 'md', width: '60%' })} />
						<div class={css({ height: '48px', bg: 'gray.a2', borderRadius: 'md', width: '100%' })} />
						<div class={css({ height: '48px', bg: 'gray.a2', borderRadius: 'md', width: '100%' })} />
						<div class={css({ height: '48px', bg: 'gray.a2', borderRadius: 'md', width: '85%' })} />
						<div style={{ 'text-align': 'center', 'padding-top': '8px' }}>
							<span class={css({ fontSize: '13px', color: 'fg.muted' })}>
								Syncing todos...
							</span>
						</div>
					</div>
				</Show>
				<Show
					when={hasTodos()}
					fallback={
						<Show when={!syncLoading()}>
							<EmptyState
								icon={SparklesIcon}
								title="All clear!"
								description="Your to-do list is empty. Add something above to get started."
								hint="Press Enter to add quickly"
							/>
						</Show>
					}
				>
					<div class={activeTodosSection}>
						<Show when={overdue().length > 0}>
							{(() => {
								const h = makeDragHandlers(overdue)
								return (
									<TodoList title="Overdue" variant="danger">
										<For each={overdue()}>
											{(todo) => <TodoItem todo={todo} onDragStart={h.onDragStart(todo.id)} onDragOver={h.onDragOver} onDrop={h.onDrop(todo.id)} onDragEnd={h.onDragEnd} />}
										</For>
									</TodoList>
								)
							})()}
						</Show>
						<Show when={today().length > 0}>
							{(() => {
								const h = makeDragHandlers(today)
								return (
									<TodoList title="Today">
										<For each={today()}>
											{(todo) => <TodoItem todo={todo} onDragStart={h.onDragStart(todo.id)} onDragOver={h.onDragOver} onDrop={h.onDrop(todo.id)} onDragEnd={h.onDragEnd} />}
										</For>
									</TodoList>
								)
							})()}
						</Show>
						<Show when={upcoming().length > 0}>
							{(() => {
								const h = makeDragHandlers(upcoming)
								return (
									<TodoList title="Upcoming">
										<For each={upcoming()}>
											{(todo) => <TodoItem todo={todo} onDragStart={h.onDragStart(todo.id)} onDragOver={h.onDragOver} onDrop={h.onDrop(todo.id)} onDragEnd={h.onDragEnd} />}
										</For>
									</TodoList>
								)
							})()}
						</Show>
						<Show when={noDueDate().length > 0}>
							{(() => {
								const h = makeDragHandlers(noDueDate)
								return (
									<TodoList title="No Due Date">
										<For each={noDueDate()}>
											{(todo) => <TodoItem todo={todo} onDragStart={h.onDragStart(todo.id)} onDragOver={h.onDragOver} onDrop={h.onDrop(todo.id)} onDragEnd={h.onDragEnd} />}
										</For>
									</TodoList>
								)
							})()}
						</Show>
					</div>
					<Show when={completed().length > 0}>
						<div class={completedSection}>
							<div class={progressCard}>
								<div class={progressRing}>
									<ProgressRingSVG pct={progressPct()} />
									<span class={progressRingText}>{progressPct()}%</span>
								</div>
								<div class={progressInfo}>
									<div class={progressTitle}>
										{completedCount()} of {totalCount()} completed
									</div>
									<div class={progressSubtext}>
										{progressPct() === 100
											? 'Everything is checked off!'
											: `${activeCount()} ${activeCount() === 1 ? 'task' : 'tasks'} remaining`}
									</div>
								</div>
							</div>
							{(() => {
								const h = makeDragHandlers(completed)
								return (
									<TodoList title="Completed" variant="muted">
										<For each={completed()}>
											{(todo) => <TodoItem todo={todo} onDragStart={h.onDragStart(todo.id)} onDragOver={h.onDragOver} onDrop={h.onDrop(todo.id)} onDragEnd={h.onDragEnd} />}
										</For>
									</TodoList>
								)
							})()}
						</div>
					</Show>
				</Show>
			</div>
			{/* Share code dialog */}
			<Show when={todoListShareCode()}>
				<div
					style={{
						position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)',
						display: 'flex', 'align-items': 'center', 'justify-content': 'center',
						'z-index': '50',
					}}
					onClick={() => setTodoListShareCode('')}
				>
					<div
						style={{
							background: 'var(--colors-gray-2)', 'border-radius': '12px',
							padding: '24px', width: '380px',
							'box-shadow': '0 24px 64px -8px rgba(0,0,0,0.4)',
							border: '1px solid var(--colors-gray-a3)',
						}}
						onClick={(e: MouseEvent) => e.stopPropagation()}
					>
						<div style={{ 'font-size': '16px', 'font-weight': '600', 'margin-bottom': '4px', color: 'var(--colors-fg-default)' }}>
							Todo list shared
						</div>
						<div style={{ 'font-size': '13px', color: 'var(--colors-fg-muted)', 'margin-bottom': '16px' }}>
							Share this code with collaborators. It's been copied to your clipboard.
						</div>
						<input
							class={css({
								width: '100%', bg: 'gray.a2', border: '1px solid', borderColor: 'gray.a4',
								borderRadius: 'md', px: '3', py: '2.5', fontSize: '13px', color: 'fg.default',
								fontFamily: 'mono', outline: 'none', mb: '4',
							})}
							value={todoListShareCode()}
							readOnly
							onClick={(e) => (e.target as HTMLInputElement).select()}
						/>
						<div style={{ display: 'flex', 'justify-content': 'flex-end' }}>
							<button
								class={css({
									px: '4', py: '2', borderRadius: 'md', fontSize: '13px', fontWeight: '500',
									cursor: 'pointer', bg: 'indigo.9', color: 'white',
									_hover: { bg: 'indigo.10' },
								})}
								onClick={() => setTodoListShareCode('')}
							>
								Done
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	)
}
