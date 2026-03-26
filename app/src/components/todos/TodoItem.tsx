import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { Trash2Icon, CalendarIcon } from 'lucide-solid'
import { formatDate } from '../../lib/date-utils'

const itemStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
	px: '4',
	py: '3',
	borderRadius: 'md',
	transition: 'all 0.15s ease',
	_hover: {
		bg: 'gray.a2',
		'& .todo-delete': { opacity: 1 },
	},
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
	gap: '0.5',
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

const dueDateChip = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	fontSize: '11px',
	fontWeight: '500',
	color: 'fg.subtle',
	'&[data-overdue="true"]': {
		color: 'red.9',
	},
})

const dueDateIcon = css({
	width: '3',
	height: '3',
})

const deleteBtn = css({
	opacity: 0,
	transition: 'all 0.15s',
	cursor: 'pointer',
	color: 'fg.subtle',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '7',
	height: '7',
	borderRadius: 'md',
	flexShrink: 0,
	_hover: { bg: 'red.a2', color: 'red.11' },
})

export function TodoItem(props: { todo: Todo }) {
	const store = useAppStore()

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

	const isOverdue = () => {
		if (!props.todo.due_date || props.todo.is_completed) return false
		return props.todo.due_date < new Date().toISOString().split('T')[0]
	}

	return (
		<div class={itemStyle}>
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
				<span
					class={textStyle}
					data-completed={!!props.todo.is_completed}
				>
					{props.todo.text}
				</span>
				{props.todo.due_date && (
					<span class={dueDateChip} data-overdue={isOverdue()}>
						<CalendarIcon class={dueDateIcon} />
						{formatDate(props.todo.due_date)}
					</span>
				)}
			</div>
			<span class={`todo-delete ${deleteBtn}`} onClick={handleDelete}>
				<Trash2Icon class={css({ width: '3.5', height: '3.5' })} />
			</span>
		</div>
	)
}
