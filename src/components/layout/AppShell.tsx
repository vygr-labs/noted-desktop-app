import { Show, createSignal, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { Sidebar } from './Sidebar'
import { NoteList } from './NoteList'
import { EditorPane } from './EditorPane'
import { Titlebar } from './Titlebar'
import { TodoView } from '../todos/TodoView'
import { useAppStore } from '../../stores/app-store'

const outerShell = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100vh',
	width: '100vw',
	overflow: 'hidden',
	bg: 'bg.canvas',
})

const shellStyle = css({
	display: 'flex',
	flex: 1,
	overflow: 'hidden',
})

const sidebarStyle = css({
	display: 'flex',
	flexDirection: 'column',
	overflow: 'hidden',
	bg: 'bg.subtle',
	transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
	position: 'relative',
	flexShrink: 0,
	borderRight: '1px solid',
	borderRightColor: 'gray.a3',
})

const noteListStyle = css({
	display: 'flex',
	flexDirection: 'column',
	overflow: 'hidden',
	position: 'relative',
	flexShrink: 0,
	borderRight: '1px solid',
	borderRightColor: 'gray.a3',
})

const resizeHandle = css({
	position: 'absolute',
	top: 0,
	right: '-3px',
	bottom: 0,
	width: '6px',
	cursor: 'col-resize',
	zIndex: 10,
	transition: 'background 0.15s',
	_hover: {
		bg: 'indigo.a3',
	},
	'&[data-dragging="true"]': {
		bg: 'indigo.a4',
	},
})

const editorStyle = css({
	flex: 1,
	display: 'flex',
	flexDirection: 'column',
	overflow: 'hidden',
	minWidth: 0,
})

export function AppShell() {
	const store = useAppStore()
	const [noteListWidth, setNoteListWidth] = createSignal(300)
	const [isDragging, setIsDragging] = createSignal(false)

	const isTodoView = () => store.currentView() === 'todos'
	const sidebarWidth = () => (store.sidebarCollapsed() ? 60 : 220)

	// Keyboard shortcuts
	onMount(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Ctrl+K: command palette
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault()
				store.setCommandPaletteOpen(!store.commandPaletteOpen())
			}
			// Ctrl+Shift+F: focus mode
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
				e.preventDefault()
				store.setFocusMode(!store.focusMode())
			}
			// Ctrl+B: toggle sidebar
			if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
				e.preventDefault()
				store.setSidebarCollapsed(!store.sidebarCollapsed())
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
	})

	// Note list resize logic
	function handleResizeStart(e: MouseEvent) {
		e.preventDefault()
		setIsDragging(true)
		const startX = e.clientX
		const startWidth = noteListWidth()

		function onMouseMove(e: MouseEvent) {
			const delta = e.clientX - startX
			const newWidth = Math.max(220, Math.min(500, startWidth + delta))
			setNoteListWidth(newWidth)
		}

		function onMouseUp() {
			setIsDragging(false)
			window.removeEventListener('mousemove', onMouseMove)
			window.removeEventListener('mouseup', onMouseUp)
		}

		window.addEventListener('mousemove', onMouseMove)
		window.addEventListener('mouseup', onMouseUp)
	}

	return (
		<div class={outerShell}>
			<Titlebar />
			<div class={shellStyle}>
			<Show when={!store.focusMode()}>
				<div
					class={sidebarStyle}
					style={{ width: `${sidebarWidth()}px`, 'min-width': `${sidebarWidth()}px` }}
				>
					<Sidebar />
				</div>
			</Show>
			<Show
				when={!isTodoView()}
				fallback={
					<div class={editorStyle}>
						<TodoView />
					</div>
				}
			>
				<Show when={!store.focusMode()}>
					<div
						class={noteListStyle}
						style={{ width: `${noteListWidth()}px` }}
					>
						<NoteList />
						<div
							class={resizeHandle}
							data-dragging={isDragging()}
							onMouseDown={handleResizeStart}
						/>
					</div>
				</Show>
				<div class={editorStyle}>
					<EditorPane />
				</div>
			</Show>
			</div>
		</div>
	)
}
