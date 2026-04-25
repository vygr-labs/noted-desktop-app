import { createMemo, createSignal, For, Show, createEffect, on } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { NoteCard } from '../note-list/NoteCard'
import { NoteListHeader } from '../note-list/NoteListHeader'
import { getTodayDate, formatDailyDate } from '../../lib/date-utils'
import { CalendarIcon } from 'lucide-solid'

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
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: '4',
	py: '2.5',
	fontSize: 'sm',
	color: 'fg.muted',
	fontWeight: '500',
	letterSpacing: '-0.01em',
})

const datePickerWrap = css({
	position: 'relative',
	display: 'flex',
	alignItems: 'center',
})

const datePickerBtn = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	px: '2',
	py: '1',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	fontSize: '12px',
	fontWeight: '500',
	transition: 'all 0.12s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const hiddenDateInput = css({
	position: 'absolute',
	inset: 0,
	opacity: 0,
	cursor: 'pointer',
	width: '100%',
	height: '100%',
	border: 'none',
	padding: 0,
	background: 'transparent',
})

const sectionLabel = css({
	px: '5',
	pt: '4',
	pb: '1.5',
	fontSize: '12px',
	fontWeight: '600',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.04em',
})

const iconSize = css({ width: '3.5', height: '3.5' })

export function DailyNoteView() {
	const store = useAppStore()
	const today = getTodayDate()
	const [history, setHistory] = createSignal<Note[]>([])

	async function loadHistory() {
		const all = await window.electronAPI.fetchAllDailyNotes()
		setHistory(all)
	}

	// Initial load + refresh whenever the global notes resource changes
	// (so edits to a daily note bubble through and the history stays current).
	createEffect(on(() => store.notes(), () => { loadHistory() }))

	const todayNote = createMemo(() =>
		history().find((n) => n.daily_date === today)
	)

	const pastNotes = createMemo(() =>
		history().filter(
			(n) => n.daily_date !== today && (n.content_plain?.trim() ?? '') !== ''
		)
	)

	async function ensureTodayAndSelect() {
		const existing = todayNote()
		if (existing) {
			store.setSelectedNoteId(existing.id)
			return
		}
		const note = await window.electronAPI.getOrCreateDailyNote(today)
		store.refetchNotes()
		await loadHistory()
		store.setSelectedNoteId(note.id)
	}

	async function handlePickDate(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value
		if (!value) return
		const note = await window.electronAPI.getOrCreateDailyNote(value)
		store.refetchNotes()
		await loadHistory()
		store.setSelectedNoteId(note.id)
	}

	return (
		<div class={container}>
			<NoteListHeader
				title="Today"
				onCreateNote={ensureTodayAndSelect}
				showCreate={false}
			/>
			<div class={dailyInfo}>
				<span>{formatDailyDate(today)}</span>
				<div class={datePickerWrap}>
					<button
						class={datePickerBtn}
						title="Jump to a date"
						type="button"
					>
						<CalendarIcon class={iconSize} />
						Jump to date
					</button>
					<input
						type="date"
						class={hiddenDateInput}
						max={today}
						onChange={handlePickDate}
						aria-label="Jump to daily note for date"
					/>
				</div>
			</div>
			<div class={scrollArea}>
				<Show
					when={todayNote()}
					fallback={
						<div
							class={css({
								px: '5',
								py: '3',
								fontSize: '13px',
								color: 'fg.subtle',
							})}
						>
							<button
								class={css({
									color: 'indigo.11',
									cursor: 'pointer',
									_hover: { textDecoration: 'underline' },
								})}
								onClick={ensureTodayAndSelect}
							>
								Start today's note
							</button>
						</div>
					}
				>
					{(note) => (
						<NoteCard
							note={note()}
							isActive={store.selectedNoteId() === note().id}
							onClick={() => store.setSelectedNoteId(note().id)}
							onRefresh={loadHistory}
							tags={store.noteTagsMap()[note().id]}
						/>
					)}
				</Show>
				<Show when={pastNotes().length > 0}>
					<div class={sectionLabel}>History</div>
					<For each={pastNotes()}>
						{(note) => (
							<NoteCard
								note={note}
								isActive={store.selectedNoteId() === note.id}
								onClick={() => store.setSelectedNoteId(note.id)}
								onRefresh={loadHistory}
								tags={store.noteTagsMap()[note.id]}
							/>
						)}
					</For>
				</Show>
			</div>
		</div>
	)
}
