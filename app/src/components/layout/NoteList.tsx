import { createMemo, Index, Show, createEffect, createSignal, on, onMount } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { useEditorStore } from '../../stores/editor-store'
import { NoteCard } from '../note-list/NoteCard'
import { NoteListHeader } from '../note-list/NoteListHeader'
import { NoteListEmpty } from '../note-list/NoteListEmpty'
import { SearchResults } from '../search/SearchResults'
import { DailyNoteView } from '../daily/DailyNoteView'
import { PinIcon } from 'lucide-solid'

const listContainer = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'hidden',
	minWidth: '300px',
})

const scrollArea = css({
	flex: 1,
	overflowY: 'auto',
	overflowX: 'hidden',
	py: '1',
})

const pinnedLabel = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	px: '5',
	pt: '3',
	pb: '1.5',
	fontSize: '12px',
	fontWeight: '600',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.04em',
})

const pinnedIcon = css({
	width: '3.5',
	height: '3.5',
})

export function NoteList() {
	const store = useAppStore()
	const editorStore = useEditorStore()
	const [listNotes, setListNotes] = createSignal<Note[]>([])

	const currentView = () => store.currentView()
	const isSearch = () => currentView() === 'search'
	const isToday = () => currentView() === 'today'
	const isTrash = () => currentView() === 'trash'

	// Load list-specific notes or trashed notes.
	// Also re-fetch when global notes change (e.g. share status updated).
	createEffect(
		on(
			() => ({ view: store.currentView(), sort: store.noteSort(), _v: store.listNotesVersion() }),
			async ({ view, sort }) => {
				if (typeof view === 'object' && view.type === 'list') {
					const notes = await window.electronAPI.fetchNotesByList(
						view.listId, sort
					)
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
		if (view === 'synced') {
			return (store.notes() || []).filter(n => n.is_shared)
		}
		return store.notes() || []
	})

	const pinnedNotes = createMemo(() =>
		displayNotes().filter((n) => n.is_pinned)
	)

	const unpinnedNotes = createMemo(() =>
		displayNotes().filter((n) => !n.is_pinned)
	)

	// Batch-load tags whenever displayed notes change
	createEffect(
		on(displayNotes, (notes) => {
			const ids = notes.map((n) => n.id)
			if (ids.length > 0) {
				store.loadTagsForNotes(ids)
			}
		})
	)

	// Only animate cards on first render, not on refetch
	const [initialRender, setInitialRender] = createSignal(true)
	onMount(() => {
		setTimeout(() => setInitialRender(false), 600)
	})

	const viewTitle = createMemo(() => {
		const view = currentView()
		if (view === 'all') return 'All Notes'
		if (view === 'today') return 'Today'
		if (view === 'synced') return 'Synced Notes'
		if (view === 'trash') return 'Trash'
		if (view === 'search') return 'Search'
		if (typeof view === 'object') {
			const list = store.lists()?.find((l) => l.id === view.listId)
				|| store.hiddenLists()?.find((l) => l.id === view.listId)
			return list?.name || 'List'
		}
		return 'Notes'
	})

	async function handleRefresh() {
		store.refetchNotes()
		const view = currentView()
		if (typeof view === 'object' && view.type === 'list') {
			const notes = await window.electronAPI.fetchNotesByList(view.listId, store.noteSort())
			setListNotes(notes)
		} else if (view === 'trash') {
			const notes = await window.electronAPI.fetchTrashedNotes()
			setListNotes(notes)
		}
	}

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
		// If in a list view, reload list notes
		if (typeof view === 'object') {
			const notes = await window.electronAPI.fetchNotesByList(view.listId, store.noteSort())
			setListNotes(notes)
		}
	}

	return (
		<div class={listContainer}>
			<Show when={isSearch()}>
				<SearchResults />
			</Show>
			<Show when={isToday()}>
				<DailyNoteView />
			</Show>
			<Show when={!isSearch() && !isToday()}>
				<NoteListHeader
					title={viewTitle()}
					onCreateNote={handleCreateNote}
					showCreate={!isTrash()}
				/>
				<div class={scrollArea}>
					<Show
						when={displayNotes().length > 0}
						fallback={
							<NoteListEmpty
								isTrash={isTrash()}
								onCreateNote={handleCreateNote}
							/>
						}
					>
						<Show when={pinnedNotes().length > 0}>
							<div class={pinnedLabel}>
								<PinIcon class={pinnedIcon} />
								Pinned
							</div>
							<Index each={pinnedNotes()}>
								{(note, i) => (
									<div
										style={initialRender() ? {
											'animation-delay': `${i * 30}ms`,
											'animation-fill-mode': 'both',
										} : {}}
									>
										<NoteCard
											note={note()}
											isActive={store.selectedNoteId() === note().id}
											onClick={() =>
												store.setSelectedNoteId(note().id)
											}
											isTrash={isTrash()}
											tags={store.noteTagsMap()[note().id]}
										/>
									</div>
								)}
							</Index>
						</Show>
						<Index each={unpinnedNotes()}>
							{(note, i) => (
								<div
									style={initialRender() ? {
										'animation-delay': `${(i + pinnedNotes().length) * 30}ms`,
										'animation-fill-mode': 'both',
									} : {}}
								>
									<NoteCard
										note={note()}
										isActive={store.selectedNoteId() === note().id}
										onClick={() =>
											store.setSelectedNoteId(note().id)
										}
										onRefresh={handleRefresh}
										isTrash={isTrash()}
										tags={store.noteTagsMap()[note().id]}
									/>
								</div>
							)}
						</Index>
					</Show>
				</div>
			</Show>
		</div>
	)
}
