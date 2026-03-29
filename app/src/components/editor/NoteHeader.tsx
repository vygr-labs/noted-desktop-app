import { createSignal, createEffect, on, Show, createMemo } from 'solid-js'
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
	let titleInputRef: HTMLInputElement | undefined

	// Update local title when note changes
	createEffect(
		on(
			() => props.note.id,
			() => {
				if (titleTimeout) {
					clearTimeout(titleTimeout)
					titleTimeout = null
				}
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

	function handleTitleChange(value: string) {
		setLocalTitle(value)
		editorStore.setLiveTitle(value || 'Untitled')
		if (titleTimeout) clearTimeout(titleTimeout)
		titleTimeout = setTimeout(() => {
			editorStore.saveNote({ title: value || 'Untitled' })
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

	return (
		<div class={headerStyle}>
			<input
				ref={titleInputRef}
				class={titleInput}
				value={localTitle()}
				onInput={(e) => handleTitleChange(e.currentTarget.value)}
				placeholder="Untitled"
				disabled={props.readonly}
			/>
			<div class={metaRow}>
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
				<Show when={editorStore.isSaving()}>
					<div class={saveIndicator}>
						<div class={saveDot} />
						<span class={saveText}>Saving</span>
					</div>
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
