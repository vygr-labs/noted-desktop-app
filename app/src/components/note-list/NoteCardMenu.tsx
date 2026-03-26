import { Show, For, createSignal, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import {
	PinIcon,
	PinOffIcon,
	Trash2Icon,
	RotateCcwIcon,
	XIcon,
	FolderInputIcon,
	CopyIcon,
} from 'lucide-solid'
import { useAppStore } from '../../stores/app-store'

export interface MenuPosition {
	x: number
	y: number
}

const menuOverlay = css({
	position: 'fixed',
	inset: 0,
	zIndex: 1000,
})

const menuStyle = css({
	position: 'fixed',
	zIndex: 1001,
	py: '1.5',
	minWidth: '180px',
	borderRadius: 'lg',
	bg: 'gray.2',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	boxShadow: '0 8px 30px -4px rgba(0, 0, 0, 0.3), 0 2px 8px -2px rgba(0, 0, 0, 0.15)',
	animation: 'fade-in 0.1s ease',
})

const menuItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	px: '3',
	py: '2',
	fontSize: '13px',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const menuItemDanger = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2.5',
	px: '3',
	py: '2',
	fontSize: '13px',
	cursor: 'pointer',
	color: 'red.11',
	transition: 'all 0.1s',
	_hover: { bg: 'red.a2' },
})

const menuDivider = css({
	height: '1px',
	bg: 'gray.a3',
	my: '1.5',
	mx: '2',
})

const menuLabel = css({
	px: '3',
	py: '1.5',
	fontSize: '11px',
	fontWeight: '600',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.04em',
})

const iconSize = css({ width: '3.5', height: '3.5', flexShrink: 0 })

const subMenu = css({
	py: '1',
	maxHeight: '200px',
	overflowY: 'auto',
})

const subMenuItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '3',
	py: '1.5',
	fontSize: '12.5px',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	'&[data-active="true"]': {
		color: 'indigo.11',
	},
})

const listDot = css({
	width: '8px',
	height: '8px',
	borderRadius: 'full',
	flexShrink: 0,
})

export function NoteCardMenu(props: {
	note: Note
	position: MenuPosition
	isTrash: boolean
	onClose: () => void
	onRefresh: () => void
}) {
	const store = useAppStore()
	const [showMoveList, setShowMoveList] = createSignal(false)
	let menuRef: HTMLDivElement | undefined

	// Adjust position to keep menu in viewport
	const adjustedPosition = () => {
		const menuWidth = 180
		const menuHeight = 260
		let x = props.position.x
		let y = props.position.y

		if (x + menuWidth > window.innerWidth) {
			x = window.innerWidth - menuWidth - 8
		}
		if (y + menuHeight > window.innerHeight) {
			y = window.innerHeight - menuHeight - 8
		}
		if (x < 0) x = 8
		if (y < 0) y = 8

		return { x, y }
	}

	// Close on Escape
	onMount(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === 'Escape') props.onClose()
		}
		window.addEventListener('keydown', handleKey)
		onCleanup(() => window.removeEventListener('keydown', handleKey))
	})

	async function handlePin() {
		await window.electronAPI.updateNote(props.note.id, {
			is_pinned: !props.note.is_pinned,
		})
		props.onRefresh()
		props.onClose()
	}

	async function handleDuplicate() {
		const note = await window.electronAPI.createNote({
			title: `${props.note.title || 'Untitled'} (copy)`,
			content: props.note.content,
			content_plain: props.note.content_plain,
			note_type: props.note.note_type,
			list_id: props.note.list_id,
		})
		props.onRefresh()
		store.setSelectedNoteId(note.id)
		props.onClose()
	}

	async function handleTrash() {
		await window.electronAPI.trashNote(props.note.id)
		if (store.selectedNoteId() === props.note.id) {
			store.setSelectedNoteId(null)
		}
		props.onRefresh()
		props.onClose()
	}

	async function handleRestore() {
		await window.electronAPI.restoreNote(props.note.id)
		props.onRefresh()
		props.onClose()
	}

	async function handleDeletePermanently() {
		await window.electronAPI.deleteNotePermanently(props.note.id)
		if (store.selectedNoteId() === props.note.id) {
			store.setSelectedNoteId(null)
		}
		props.onRefresh()
		props.onClose()
	}

	async function handleMoveToList(listId: string | null) {
		await window.electronAPI.updateNote(props.note.id, {
			list_id: listId,
		})
		props.onRefresh()
		props.onClose()
	}

	return (
		<>
			<div class={menuOverlay} onClick={props.onClose} onContextMenu={(e) => { e.preventDefault(); props.onClose() }} />
			<div
				ref={menuRef}
				class={menuStyle}
				style={{
					left: `${adjustedPosition().x}px`,
					top: `${adjustedPosition().y}px`,
				}}
			>
				<Show
					when={!props.isTrash}
					fallback={
						<>
							<div class={menuItem} onClick={handleRestore}>
								<RotateCcwIcon class={iconSize} />
								Restore
							</div>
							<div class={menuDivider} />
							<div class={menuItemDanger} onClick={handleDeletePermanently}>
								<XIcon class={iconSize} />
								Delete permanently
							</div>
						</>
					}
				>
					<div class={menuItem} onClick={handlePin}>
						<Show when={props.note.is_pinned} fallback={<PinIcon class={iconSize} />}>
							<PinOffIcon class={iconSize} />
						</Show>
						{props.note.is_pinned ? 'Unpin' : 'Pin to top'}
					</div>
					<div class={menuItem} onClick={handleDuplicate}>
						<CopyIcon class={iconSize} />
						Duplicate
					</div>
					<div class={menuDivider} />

					{/* Move to list */}
					<div
						class={menuItem}
						onClick={() => setShowMoveList(!showMoveList())}
					>
						<FolderInputIcon class={iconSize} />
						Move to list
					</div>
					<Show when={showMoveList()}>
						<div class={subMenu}>
							<div
								class={subMenuItem}
								data-active={!props.note.list_id}
								onClick={() => handleMoveToList(null)}
							>
								No list
							</div>
							<For each={store.lists() || []}>
								{(list) => (
									<div
										class={subMenuItem}
										data-active={props.note.list_id === list.id}
										onClick={() => handleMoveToList(list.id)}
									>
										<div
											class={listDot}
											style={{ background: `var(--colors-${list.color || 'gray'}-9)` }}
										/>
										{list.name}
									</div>
								)}
							</For>
						</div>
					</Show>

					<div class={menuDivider} />
					<div class={menuItemDanger} onClick={handleTrash}>
						<Trash2Icon class={iconSize} />
						Delete
					</div>
				</Show>
			</div>
		</>
	)
}
