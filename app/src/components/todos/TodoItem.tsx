import { Show, createSignal } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import {
	Trash2Icon,
	CalendarIcon,
	GripVerticalIcon,
	AlignLeftIcon,
	CheckIcon,
	XIcon,
	PencilIcon,
} from 'lucide-solid'
import { formatDate } from '../../lib/date-utils'

const itemStyle = css({
	display: 'flex',
	alignItems: 'flex-start',
	gap: '2',
	px: '4',
	py: '3',
	borderRadius: 'md',
	transition: 'all 0.15s ease',
	_hover: {
		bg: 'gray.a2',
		'& .todo-actions': { opacity: 1 },
		'& .todo-grip': { opacity: 0.5 },
	},
})

const gripHandle = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '5',
	height: '5',
	flexShrink: 0,
	cursor: 'grab',
	color: 'fg.subtle',
	opacity: 0,
	transition: 'opacity 0.15s',
	mt: '0.5',
	_active: { cursor: 'grabbing' },
})

const checkboxOuter = css({
	position: 'relative',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	flexShrink: 0,
	width: '20px',
	height: '20px',
	borderRadius: 'full',
	borderWidth: '2px',
	borderStyle: 'solid',
	borderColor: 'gray.a5',
	cursor: 'pointer',
	transition: 'all 0.2s ease',
	mt: '1px',
	_hover: { borderColor: 'indigo.8' },
	'&[data-checked="true"]': {
		bg: 'indigo.9',
		borderColor: 'indigo.9',
	},
})

const checkmark = css({
	position: 'absolute',
	width: '10px',
	height: '10px',
	color: 'white',
	opacity: 0,
	transform: 'scale(0)',
	transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
	'[data-checked="true"] &': {
		opacity: 1,
		transform: 'scale(1)',
	},
})

const contentCol = css({
	flex: 1,
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
	minWidth: 0,
})

const textStyle = css({
	fontSize: '14px',
	color: 'fg.default',
	transition: 'all 0.25s ease',
	lineHeight: '1.5',
	letterSpacing: '-0.01em',
	'&[data-completed="true"]': {
		textDecoration: 'line-through',
		textDecorationColor: 'fg.subtle',
		color: 'fg.muted',
	},
})

const metaRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
	flexWrap: 'wrap',
})

const chip = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	fontSize: '11px',
	fontWeight: '500',
	color: 'fg.subtle',
	'&[data-overdue="true"]': { color: 'red.9' },
	'&[data-warn="true"]': { color: 'orange.9' },
})

const chipIcon = css({ width: '3', height: '3' })

const expandedArea = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
	mt: '1',
	pt: '2',
	borderTop: '1px solid',
	borderTopColor: 'gray.a2',
	animation: 'fade-in 0.15s ease',
})

const fieldRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
})

const fieldLabel = css({
	fontSize: '11px',
	fontWeight: '600',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	width: '80px',
	flexShrink: 0,
})

const fieldInput = css({
	flex: 1,
	fontSize: '13px',
	color: 'fg.default',
	bg: 'gray.a2',
	border: 'none',
	outline: 'none',
	borderRadius: 'sm',
	px: '2.5',
	py: '1.5',
	fontFamily: 'inherit',
	_focus: { bg: 'gray.a3' },
	'&::placeholder': { color: 'fg.subtle' },
})

const fieldTextarea = css({
	flex: 1,
	fontSize: '13px',
	color: 'fg.default',
	bg: 'gray.a2',
	border: 'none',
	outline: 'none',
	borderRadius: 'sm',
	px: '2.5',
	py: '1.5',
	fontFamily: 'inherit',
	resize: 'vertical',
	minHeight: '60px',
	lineHeight: '1.5',
	_focus: { bg: 'gray.a3' },
	'&::placeholder': { color: 'fg.subtle' },
})

const actionsCol = css({
	display: 'flex',
	alignItems: 'center',
	gap: '0.5',
	opacity: 0,
	transition: 'opacity 0.15s',
	mt: '0.5',
})

const actionBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '6',
	height: '6',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	transition: 'all 0.12s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const deleteActionBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '6',
	height: '6',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	transition: 'all 0.12s',
	_hover: { bg: 'red.a2', color: 'red.11' },
})

const editBtnRow = css({
	display: 'flex',
	justifyContent: 'flex-end',
	gap: '2',
	mt: '1',
})

const editBtn = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	px: '3',
	py: '1.5',
	borderRadius: 'md',
	fontSize: '12px',
	fontWeight: '500',
	cursor: 'pointer',
	transition: 'all 0.12s',
})

const smallIcon = css({ width: '3.5', height: '3.5' })

export function TodoItem(props: {
	todo: Todo
	onDragStart?: (e: DragEvent) => void
	onDragOver?: (e: DragEvent) => void
	onDrop?: (e: DragEvent) => void
	onDragEnd?: (e: DragEvent) => void
}) {
	const store = useAppStore()
	const [expanded, setExpanded] = createSignal(false)

	// Draft state for editing — only saved on explicit Save
	const [draftText, setDraftText] = createSignal('')
	const [draftDueDate, setDraftDueDate] = createSignal('')
	const [draftDescription, setDraftDescription] = createSignal('')

	async function handleToggle() {
		await window.electronAPI.updateTodo(props.todo.id, {
			is_completed: !props.todo.is_completed,
		})
		store.refetchTodos()
	}

	async function handleDelete() {
		await window.electronAPI.deleteTodo(props.todo.id)
		store.refetchTodos()
	}

	function openEdit() {
		// Populate draft from current todo values
		setDraftText(props.todo.text)
		setDraftDueDate(props.todo.due_date || '')
		setDraftDescription(props.todo.description || '')
		setExpanded(true)
	}

	function cancelEdit() {
		setExpanded(false)
	}

	async function saveEdit() {
		const text = draftText().trim()
		if (!text) return

		const updates: Record<string, unknown> = {}
		if (text !== props.todo.text) updates.text = text
		if (draftDueDate() !== (props.todo.due_date || '')) updates.due_date = draftDueDate() || null
		if (draftDescription() !== (props.todo.description || '')) updates.description = draftDescription() || null

		if (Object.keys(updates).length > 0) {
			await window.electronAPI.updateTodo(props.todo.id, updates)
			store.refetchTodos()
		}
		setExpanded(false)
	}

	function handleEditKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') cancelEdit()
	}

	const isOverdue = () => {
		if (!props.todo.due_date || props.todo.is_completed) return false
		if (props.todo.due_date.includes('T')) {
			return new Date(props.todo.due_date) < new Date()
		}
		return props.todo.due_date < new Date().toISOString().split('T')[0]
	}

	const isDueSoon = () => {
		if (!props.todo.due_date || props.todo.is_completed || isOverdue()) return false
		if (!props.todo.due_date.includes('T')) return false
		const hoursLeft = (new Date(props.todo.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
		return hoursLeft <= 24
	}

	const formatDueDate = () => {
		const d = props.todo.due_date
		if (!d) return ''
		if (d.includes('T')) {
			return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
		}
		return formatDate(d)
	}

	return (
		<div
			class={itemStyle}
			draggable={!expanded()}
			onDragStart={props.onDragStart}
			onDragOver={props.onDragOver}
			onDrop={props.onDrop}
			onDragEnd={props.onDragEnd}
		>
			<div class={`todo-grip ${gripHandle}`}>
				<GripVerticalIcon class={css({ width: '3.5', height: '3.5' })} />
			</div>
			<div
				class={checkboxOuter}
				data-checked={!!props.todo.is_completed}
				onClick={handleToggle}
			>
				<svg class={checkmark} viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M2.5 6.5L5 9L9.5 3.5" />
				</svg>
			</div>
			<div class={contentCol}>
				<Show
					when={expanded()}
					fallback={
						<span
							class={textStyle}
							data-completed={!!props.todo.is_completed}
						>
							{props.todo.text}
						</span>
					}
				>
					<input
						class={`${fieldInput} ${css({ fontSize: '14px', fontWeight: '500' })}`}
						value={draftText()}
						onInput={(e) => setDraftText(e.currentTarget.value)}
						onKeyDown={handleEditKeyDown}
						placeholder="Todo title..."
						ref={(el) => requestAnimationFrame(() => el.focus())}
					/>
				</Show>
				<Show when={!expanded()}>
					<div class={metaRow}>
						<Show when={props.todo.due_date}>
							<span class={chip} data-overdue={isOverdue()} data-warn={isDueSoon()}>
								<CalendarIcon class={chipIcon} />
								{formatDueDate()}
							</span>
						</Show>
						<Show when={props.todo.description}>
							<span class={chip}>
								<AlignLeftIcon class={chipIcon} />
								note
							</span>
						</Show>
					</div>
				</Show>
				<Show when={expanded()}>
					<div class={expandedArea}>
						<div class={fieldRow}>
							<span class={fieldLabel}>Due</span>
							<input
								class={fieldInput}
								type="datetime-local"
								value={draftDueDate()}
								onInput={(e) => setDraftDueDate(e.currentTarget.value)}
								onKeyDown={handleEditKeyDown}
							/>
						</div>
						<div class={fieldRow} style={{ 'align-items': 'flex-start' }}>
							<span class={fieldLabel} style={{ 'margin-top': '6px' }}>Description</span>
							<textarea
								class={fieldTextarea}
								value={draftDescription()}
								onInput={(e) => setDraftDescription(e.currentTarget.value)}
								onKeyDown={handleEditKeyDown}
								placeholder="Add a description..."
							/>
						</div>
						<div class={editBtnRow}>
							<button
								class={`${editBtn} ${css({ bg: 'gray.a3', color: 'fg.default', _hover: { bg: 'gray.a4' } })}`}
								onClick={cancelEdit}
							>
								<XIcon class={css({ width: '3', height: '3' })} />
								Cancel
							</button>
							<button
								class={`${editBtn} ${css({ bg: 'indigo.9', color: 'white', _hover: { bg: 'indigo.10' } })}`}
								onClick={saveEdit}
							>
								<CheckIcon class={css({ width: '3', height: '3' })} />
								Save
							</button>
						</div>
					</div>
				</Show>
			</div>
			<Show when={!expanded()}>
				<div class={`todo-actions ${actionsCol}`}>
					<button
						class={actionBtn}
						onClick={openEdit}
						title="Edit"
					>
						<PencilIcon class={smallIcon} />
					</button>
					<button class={deleteActionBtn} onClick={handleDelete} title="Delete">
						<Trash2Icon class={smallIcon} />
					</button>
				</div>
			</Show>
		</div>
	)
}
