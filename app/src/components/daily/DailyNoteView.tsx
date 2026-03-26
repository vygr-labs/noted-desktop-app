import { createResource, Show } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { NoteCard } from '../note-list/NoteCard'
import { NoteListHeader } from '../note-list/NoteListHeader'
import { getTodayDate, formatDailyDate } from '../../lib/date-utils'

const container = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'hidden',
})

const scrollArea = css({
	flex: 1,
	overflowY: 'auto',
	py: '1',
})

const dailyInfo = css({
	px: '4',
	py: '2.5',
	fontSize: 'sm',
	color: 'fg.muted',
	fontWeight: '500',
	letterSpacing: '-0.01em',
})

export function DailyNoteView() {
	const store = useAppStore()
	const today = getTodayDate()

	const [dailyNote] = createResource(async () => {
		return window.electronAPI.getOrCreateDailyNote(today)
	})

	function handleSelectDaily() {
		const note = dailyNote()
		if (note) {
			store.setSelectedNoteId(note.id)
		}
	}

	return (
		<div class={container}>
			<NoteListHeader
				title="Today"
				onCreateNote={handleSelectDaily}
				showCreate={false}
			/>
			<div class={dailyInfo}>{formatDailyDate(today)}</div>
			<div class={scrollArea}>
				<Show when={dailyNote()}>
					{(note) => (
						<NoteCard
							note={note()}
							isActive={store.selectedNoteId() === note().id}
							onClick={() => store.setSelectedNoteId(note().id)}
						/>
					)}
				</Show>
			</div>
		</div>
	)
}
