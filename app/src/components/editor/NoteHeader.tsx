import { createSignal, createEffect, on, onCleanup, Show, createMemo } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useEditorStore } from '../../stores/editor-store'
import { useAppStore } from '../../stores/app-store'
import { formatCreatedDate, formatRelativeEdited } from '../../lib/date-utils'
import {
	PinIcon,
	PinOffIcon,
	Trash2Icon,
	RotateCcwIcon,
	XIcon,
	ExternalLinkIcon,
	SpellCheckIcon,
	SpellCheck2Icon,
} from 'lucide-solid'

const headerStyle = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '2',
	flexShrink: 0,
	mb: '2',
})

const titleInput = css({
	width: '100%',
	fontSize: '28px',
	fontWeight: '700',
	color: 'fg.default',
	bg: 'transparent',
	border: 'none',
	outline: 'none',
	padding: 0,
	letterSpacing: '-0.03em',
	lineHeight: '1.2',
	'&::placeholder': { color: 'gray.a5' },
})

const metaRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
	flexWrap: 'wrap',
})

const metaText = css({
	fontSize: '13px',
	color: 'fg.subtle',
	letterSpacing: '-0.01em',
})

const metaDivider = css({
	width: '3px',
	height: '3px',
	borderRadius: 'full',
	bg: 'gray.a5',
	flexShrink: 0,
})

const listChip = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1.5',
	maxWidth: '220px',
	fontSize: '13px',
	color: 'fg.subtle',
	bg: 'transparent',
	border: 'none',
	padding: 0,
	cursor: 'pointer',
	letterSpacing: '-0.01em',
	transition: 'color 0.15s',
	_hover: { color: 'fg.default' },
})

const listChipName = css({
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
})

const listDot = css({
	width: '8px',
	height: '8px',
	borderRadius: 'full',
	flexShrink: 0,
})

const actionsRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
	marginLeft: 'auto',
})

const actionBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '7',
	height: '7',
	borderRadius: 'lg',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const iconSize = css({ width: '3.5', height: '3.5' })

const saveIndicator = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	flexShrink: 0,
	animation: 'fade-in 0.2s ease',
})

const saveDot = css({
	width: '6px',
	height: '6px',
	borderRadius: 'full',
	bg: 'indigo.9',
	animation: 'save-pulse 1s ease-in-out infinite',
})

const saveText = css({
	fontSize: '12px',
	color: 'fg.muted',
	fontWeight: '500',
})

export function NoteHeader(props: { note: Note; readonly?: boolean }) {
	const editorStore = useEditorStore()
	const appStore = useAppStore()
	const [localTitle, setLocalTitle] = createSignal(props.note.title)
	let titleTimeout: ReturnType<typeof setTimeout> | null = null
	let pendingTitle: string | null = null
	// The note id the pending title belongs to. Captured when typing so a flush
	// always saves to the right note even if the selection has already changed.
	let pendingTitleNoteId: string | null = null
	let titleInputRef: HTMLInputElement | undefined

	function flushPendingTitle() {
		if (titleTimeout && pendingTitle !== null && pendingTitleNoteId) {
			clearTimeout(titleTimeout)
			titleTimeout = null
			editorStore.saveNote({ title: pendingTitle }, pendingTitleNoteId)
			pendingTitle = null
			pendingTitleNoteId = null
		}
	}

	// `createMemo` dedupes by ===, so this effect only fires on a genuine note
	// switch — not on every surgical currentNote update (e.g. saveNote bumping
	// updated_at), which would otherwise clobber in-progress typing.
	const noteId = createMemo(() => props.note.id)

	// Update local title when the note changes
	createEffect(
		on(
			noteId,
			() => {
				// Flush the previous note's pending title (to ITS id) before switching.
				flushPendingTitle()
				setLocalTitle(props.note.title)

				// Auto-focus and select title for new notes
				if (editorStore.isNewNote()) {
					requestAnimationFrame(() => {
						if (titleInputRef) {
							titleInputRef.focus()
							titleInputRef.select()
						}
						editorStore.setIsNewNote(false)
					})
				}
			},
			{ defer: true }
		)
	)

	// When the open note is reloaded after an external (CLI) change, adopt the
	// fresh title.
	createEffect(
		on(
			() => editorStore.reloadNonce(),
			() => setLocalTitle(props.note.title),
			{ defer: true }
		)
	)

	// Persist any pending title if the header unmounts (note deselected) so the
	// edit isn't lost when the 300ms debounce never gets to fire.
	onCleanup(flushPendingTitle)

	// Also handle the initial mount for a new note
	requestAnimationFrame(() => {
		if (editorStore.isNewNote() && titleInputRef) {
			titleInputRef.focus()
			titleInputRef.select()
			editorStore.setIsNewNote(false)
		}
	})

	const wordCount = createMemo(() => {
		const plain = props.note.content_plain
		if (!plain || !plain.trim()) return 0
		return plain.trim().split(/\s+/).length
	})

	// The list this note belongs to, if any. Check hidden lists too so the chip
	// still resolves for notes sitting in a hidden list.
	const noteList = createMemo(() => {
		const id = props.note.list_id
		if (!id) return undefined
		const all = [...(appStore.lists() ?? []), ...(appStore.hiddenLists() ?? [])]
		return all.find((l) => l.id === id)
	})

	function handleOpenList(listId: string) {
		appStore.setCurrentView({ type: 'list', listId })
	}

	function handleTitleChange(value: string) {
		setLocalTitle(value)
		editorStore.setLiveTitle(value || 'Untitled')
		editorStore.markDirty()
		pendingTitle = value || 'Untitled'
		pendingTitleNoteId = props.note.id
		if (titleTimeout) clearTimeout(titleTimeout)
		titleTimeout = setTimeout(async () => {
			const targetId = pendingTitleNoteId
			await editorStore.saveNote({ title: pendingTitle! }, targetId ?? undefined)
			pendingTitle = null
			pendingTitleNoteId = null
			appStore.bumpListNotes()
		}, 300)
	}

	async function handleSpellcheck() {
		await window.electronAPI.updateNote(props.note.id, {
			spellcheck: !props.note.spellcheck,
		})
		editorStore.loadNote(props.note.id)
	}

	async function handlePin() {
		await window.electronAPI.updateNote(props.note.id, {
			is_pinned: !props.note.is_pinned,
		})
		appStore.refetchNotes()
		editorStore.loadNote(props.note.id)
	}

	async function handleTrash() {
		await window.electronAPI.trashNote(props.note.id)
		appStore.refetchNotes()
		appStore.setSelectedNoteId(null)
	}

	async function handleRestore() {
		await window.electronAPI.restoreNote(props.note.id)
		appStore.refetchNotes()
		appStore.setSelectedNoteId(null)
	}

	async function handleDeletePermanently() {
		await window.electronAPI.deleteNotePermanently(props.note.id)
		appStore.refetchNotes()
		appStore.setSelectedNoteId(null)
	}

	const isSyncing = () => props.note.is_shared && !props.note.content && !props.note.content_plain

	return (
		<div class={headerStyle}>
			<Show when={!isSyncing()} fallback={
				<div class={css({ height: '32px', width: '50%', borderRadius: 'md', bg: 'gray.a3', mt: '1', animation: 'pulse 1.5s ease-in-out infinite' })} />
			}>
				<input
					ref={titleInputRef}
					class={titleInput}
					value={localTitle()}
					onInput={(e) => handleTitleChange(e.currentTarget.value)}
					placeholder="Untitled"
					disabled={props.readonly}
				/>
			</Show>
			<div class={metaRow}>
				<Show when={noteList()}>
					{(list) => (
						<>
							<button
								class={listChip}
								onClick={() => handleOpenList(list().id)}
								title={`Open list: ${list().name}`}
							>
								<span
									class={listDot}
									style={{ background: `var(--colors-${list().color || 'gray'}-9)` }}
								/>
								<span class={listChipName}>{list().name}</span>
							</button>
							<div class={metaDivider} />
						</>
					)}
				</Show>
				<span class={metaText}>
					{formatCreatedDate(props.note.created_at)}
				</span>
				<div class={metaDivider} />
				<span class={metaText}>
					{formatRelativeEdited(props.note.updated_at)}
				</span>
				<Show when={wordCount() > 0}>
					<div class={metaDivider} />
					<span class={metaText}>
						{wordCount()} {wordCount() === 1 ? 'word' : 'words'}
					</span>
				</Show>
					<div class={actionsRow}>
					<Show
						when={!props.readonly}
						fallback={
							<>
								<button
									class={actionBtn}
									onClick={handleRestore}
									title="Restore"
								>
									<RotateCcwIcon class={iconSize} />
								</button>
								<button
									class={actionBtn}
									onClick={handleDeletePermanently}
									title="Delete permanently"
								>
									<XIcon class={iconSize} />
								</button>
							</>
						}
					>
						<button
							class={actionBtn}
							onClick={() => {
								window.electronAPI.openPopout({
									view: 'note',
									listId: props.note.id,
									title: props.note.title || 'Untitled',
								})
							}}
							title="Pop out note"
						>
							<ExternalLinkIcon class={iconSize} />
						</button>
						<button
							class={actionBtn}
							onClick={handleSpellcheck}
							title={props.note.spellcheck ? 'Disable spellcheck' : 'Enable spellcheck'}
						>
							<Show
								when={props.note.spellcheck}
								fallback={<SpellCheckIcon class={iconSize} />}
							>
								<SpellCheck2Icon class={iconSize} />
							</Show>
						</button>
						<button class={actionBtn} onClick={handlePin} title="Pin/Unpin">
							<Show
								when={props.note.is_pinned}
								fallback={<PinIcon class={iconSize} />}
							>
								<PinOffIcon class={iconSize} />
							</Show>
						</button>
						<button class={actionBtn} onClick={handleTrash} title="Delete">
							<Trash2Icon class={iconSize} />
						</button>
					</Show>
				</div>
			</div>
		</div>
	)
}
