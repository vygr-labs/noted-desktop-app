import { createMemo, For, Show, createEffect, createSignal, on } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { useEditorStore } from '../../stores/editor-store'
import { PlusIcon, PinIcon, XIcon } from 'lucide-solid'

const tabBarContainer = css({
	display: 'flex',
	alignItems: 'center',
	gap: '0',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a3',
	bg: 'bg.subtle',
	flexShrink: 0,
	overflow: 'hidden',
	minHeight: '36px',
})

const tabScroll = css({
	display: 'flex',
	alignItems: 'center',
	flex: 1,
	overflowX: 'auto',
	overflowY: 'hidden',
	scrollbarWidth: 'none',
	'&::-webkit-scrollbar': { display: 'none' },
})

const tabStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	px: '3',
	py: '1.5',
	fontSize: '12px',
	fontWeight: '500',
	color: 'fg.muted',
	cursor: 'pointer',
	whiteSpace: 'nowrap',
	borderRight: '1px solid',
	borderRightColor: 'gray.a4',
	flexShrink: 0,
	maxWidth: '180px',
	transition: 'all 0.1s',
	position: 'relative',
	_hover: {
		color: 'fg.default',
		bg: 'gray.a2',
		'& .tab-close': { opacity: 0.5 },
	},
	'&[data-active="true"]': {
		color: 'fg.default',
		bg: 'bg.default',
		fontWeight: '600',
		'&::after': {
			content: '""',
			position: 'absolute',
			bottom: '-1px',
			left: 0,
			right: 0,
			height: '2px',
			bg: 'indigo.9',
		},
	},
})

const tabClose = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '14px',
	height: '14px',
	borderRadius: 'sm',
	opacity: 0.4,
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a4', opacity: '1 !important' },
})

const pinDot = css({
	width: '3',
	height: '3',
	color: 'fg.subtle',
})

const addTabBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '28px',
	height: '28px',
	flexShrink: 0,
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	mx: '1',
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const tabTitle = css({
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
})

const smallIcon = css({ width: '3', height: '3' })

export function NoteTabBar() {
	const store = useAppStore()
	const editorStore = useEditorStore()
	const [listNotes, setListNotes] = createSignal<Note[]>([])
	let scrollRef: HTMLDivElement | undefined

	const currentView = () => store.currentView()
	const isTrash = () => currentView() === 'trash'

	createEffect(
		on(
			() => ({ view: store.currentView(), sort: store.noteSort() }),
			async ({ view, sort }) => {
				if (typeof view === 'object' && view.type === 'list') {
					const notes = await window.electronAPI.fetchNotesByList(view.listId, sort)
					setListNotes(notes)
				} else if (view === 'trash') {
					const notes = await window.electronAPI.fetchTrashedNotes()
					setListNotes(notes)
				}
			}
		)
	)

	const displayNotes = createMemo(() => {
		const view = currentView()
		if (view === 'trash' || (typeof view === 'object' && view.type === 'list')) {
			return listNotes()
		}
		return store.notes() || []
	})

	// Scroll active tab into view
	createEffect(
		on(
			() => store.selectedNoteId(),
			(id) => {
				if (!id || !scrollRef) return
				requestAnimationFrame(() => {
					const active = scrollRef?.querySelector('[data-active="true"]') as HTMLElement
					active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
				})
			}
		)
	)

	async function handleCreateNote() {
		const view = currentView()
		const listId = typeof view === 'object' ? view.listId : null
		const note = await window.electronAPI.createNote({
			title: 'Untitled',
			list_id: listId,
		})
		store.refetchNotes()
		editorStore.setIsNewNote(true)
		store.setSelectedNoteId(note.id)
		if (typeof view === 'object') {
			const notes = await window.electronAPI.fetchNotesByList(view.listId, store.noteSort())
			setListNotes(notes)
		}
	}

	function tabTitleText(note: Note): string {
		const active = store.selectedNoteId() === note.id
		if (active) {
			const live = editorStore.liveTitle()
			if (live !== null) return live
		}
		return note.title || 'Untitled'
	}

	return (
		<Show when={currentView() !== 'search' && currentView() !== 'today' && currentView() !== 'todos'}>
			<div class={tabBarContainer}>
				<div
					class={tabScroll}
					ref={scrollRef}
					onWheel={(e) => {
						if (scrollRef) {
							e.preventDefault()
							scrollRef.scrollLeft += e.deltaY || e.deltaX
						}
					}}
				>
					<For each={displayNotes()}>
						{(note) => (
							<div
								class={tabStyle}
								data-active={store.selectedNoteId() === note.id}
								onClick={() => store.setSelectedNoteId(note.id)}
							>
								<Show when={note.is_pinned}>
									<PinIcon class={pinDot} />
								</Show>
								<span class={tabTitle}>{tabTitleText(note)}</span>
								<Show when={store.selectedNoteId() === note.id}>
									<div
										class={`tab-close ${tabClose}`}
										onClick={(e) => {
											e.stopPropagation()
											store.setSelectedNoteId(null)
										}}
									>
										<XIcon class={css({ width: '2.5', height: '2.5' })} />
									</div>
								</Show>
							</div>
						)}
					</For>
				</div>
				<Show when={!isTrash()}>
					<button class={addTabBtn} onClick={handleCreateNote} title="New note">
						<PlusIcon class={smallIcon} />
					</button>
				</Show>
			</div>
		</Show>
	)
}
