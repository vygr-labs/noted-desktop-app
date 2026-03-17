import { createMemo, Index, Show, createEffect, createSignal, on } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { NoteCard } from '../note-list/NoteCard'
import { NoteListHeader } from '../note-list/NoteListHeader'
import { NoteListEmpty } from '../note-list/NoteListEmpty'
import { SearchResults } from '../search/SearchResults'
import { DailyNoteView } from '../daily/DailyNoteView'

const listContainer = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'hidden',
})

const scrollArea = css({
	flex: 1,
	overflowY: 'auto',
	overflowX: 'hidden',
	py: '1',
})

export function NoteList() {
	const store = useAppStore()
	const [listNotes, setListNotes] = createSignal<Note[]>([])

	const currentView = () => store.currentView()
	const isSearch = () => currentView() === 'search'
	const isToday = () => currentView() === 'today'
	const isTrash = () => currentView() === 'trash'

	// Load list-specific notes or trashed notes
	createEffect(
		on(
			() => ({ view: store.currentView(), sort: store.noteSort() }),
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
		return store.notes() || []
	})

	const viewTitle = createMemo(() => {
		const view = currentView()
		if (view === 'all') return 'All Notes'
		if (view === 'today') return 'Today'
		if (view === 'trash') return 'Trash'
		if (view === 'search') return 'Search'
		if (typeof view === 'object') {
			const list = store.lists()?.find((l) => l.id === view.listId)
			return list?.name || 'List'
		}
		return 'Notes'
	})

	async function handleCreateNote() {
		const view = currentView()
		const listId = typeof view === 'object' ? view.listId : null
		const note = await window.electronAPI.createNote({
			title: 'Untitled',
			list_id: listId,
		})
		store.refetchNotes()
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
						<Index each={displayNotes()}>
							{(note, i) => (
								<div
									style={{
										'animation-delay': `${i * 30}ms`,
										'animation-fill-mode': 'both',
									}}
								>
									<NoteCard
										note={note()}
										isActive={store.selectedNoteId() === note().id}
										onClick={() =>
											store.setSelectedNoteId(note().id)
										}
										isTrash={isTrash()}
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
