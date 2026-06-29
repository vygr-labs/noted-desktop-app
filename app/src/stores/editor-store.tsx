import {
	createContext,
	useContext,
	createSignal,
	createEffect,
	onMount,
	type ParentProps,
} from 'solid-js'
import { useAppStore } from './app-store'

interface EditorStore {
	currentNote: () => Note | null
	setCurrentNote: (note: Note | null) => void
	isEditing: () => boolean
	isNewNote: () => boolean
	setIsNewNote: (v: boolean) => void
	isSaving: () => boolean
	setIsSaving: (v: boolean) => void
	liveTitle: () => string | null
	setLiveTitle: (title: string) => void
	livePreview: () => string | null
	setLivePreview: (preview: string) => void
	loadNote: (id: string) => Promise<void>
	refreshCurrentNote: () => Promise<void>
	// `targetId` writes to a specific note instead of the currently-open one —
	// used when flushing a pending edit for a note we've just switched away from,
	// so the edit lands on the note it was typed in, not the new selection.
	saveNote: (data: {
		title?: string
		content?: string | null
		content_plain?: string | null
	}, targetId?: string) => Promise<void>
	// Mark the open note as having unsaved local edits. While dirty, an external
	// (CLI) change to the same note will NOT live-reload the editor, so the
	// user's in-progress typing is never clobbered.
	markDirty: () => void
	// Bumped when the open note was reloaded from disk after an external change;
	// editors watch it to reset their content to the fresh note.
	reloadNonce: () => number
}

const EditorStoreContext = createContext<EditorStore>()

export function EditorStoreProvider(props: ParentProps) {
	const appStore = useAppStore()
	const [currentNote, setCurrentNote] = createSignal<Note | null>(null)
	const [isNewNote, setIsNewNote] = createSignal(false)
	const [isSaving, setIsSaving] = createSignal(false)
	const [liveTitle, setLiveTitle] = createSignal<string | null>(null)
	const [livePreview, setLivePreview] = createSignal<string | null>(null)

	const isEditing = () => currentNote() !== null

	// Unsaved-edits flag (see markDirty in the interface). Cleared on note switch
	// and after an external reload — never mid-save, to avoid races.
	let dirty = false
	function markDirty() { dirty = true }
	const [reloadNonce, setReloadNonce] = createSignal(0)

	async function loadNote(id: string) {
		setLiveTitle(null)
		setLivePreview(null)
		dirty = false
		const note = await window.electronAPI.fetchNote(id)
		if (note) setCurrentNote(note)
	}

	async function refreshCurrentNote() {
		const note = currentNote()
		if (!note) return
		const fresh = await window.electronAPI.fetchNote(note.id)
		if (fresh) setCurrentNote(fresh)
	}

	// Reload the open note from disk after an external change, but only when the
	// editor is idle — if the user has unsaved edits (dirty) or a save is in
	// flight, leave it alone so their work isn't clobbered (their next save wins).
	async function reloadOpenNoteIfIdle() {
		const note = currentNote()
		if (!note || dirty || isSaving()) return
		// Collab notes are driven by the Yjs sync server, not the local DB row —
		// never reload them from disk underneath the live session.
		if (note.sync_id) return
		const fresh = await window.electronAPI.fetchNote(note.id)
		if (!fresh || dirty || isSaving()) return
		const changed =
			fresh.content !== note.content ||
			fresh.content_plain !== note.content_plain ||
			fresh.title !== note.title ||
			fresh.note_type !== note.note_type
		if (!changed) return
		setCurrentNote(fresh)
		// Force the editors (which only reset on a note *switch*) to adopt the
		// fresh content for this same note id.
		setReloadNonce((n) => n + 1)
	}

	async function saveNote(data: {
		title?: string
		content?: string | null
		content_plain?: string | null
	}, targetId?: string) {
		const note = currentNote()
		const id = targetId ?? note?.id
		if (!id) return

		setIsSaving(true)
		await window.electronAPI.updateNote(id, data)
		setIsSaving(false)

		// Merge the saved fields back into the in-memory note (and bump
		// updated_at) so every consumer that reads currentNote — word count,
		// the pop-out title, collab title propagation — reflects the save
		// immediately instead of staying on the value the note was loaded with.
		// Only merge when we saved the note that's actually open: a targeted save
		// to a note we've switched away from must NOT overwrite the new selection.
		// We deliberately don't refetch the note list — that would cause the
		// note to jump to the top while typing when sorting by date modified.
		const latest = currentNote()
		if (latest && latest.id === id) {
			setCurrentNote({ ...latest, ...data, updated_at: new Date().toISOString() })
		}
	}

	onMount(() => {
		window.electronAPI.onExternalDbChange(() => {
			reloadOpenNoteIfIdle()
		})
	})

	// When selected note changes, load it
	createEffect(() => {
		const id = appStore.selectedNoteId()
		if (id) {
			loadNote(id)
		} else {
			setCurrentNote(null)
		}
	})

	const store: EditorStore = {
		currentNote,
		setCurrentNote,
		isEditing,
		isNewNote,
		setIsNewNote,
		isSaving,
		setIsSaving,
		liveTitle,
		setLiveTitle,
		livePreview,
		setLivePreview,
		loadNote,
		refreshCurrentNote,
		saveNote,
		markDirty,
		reloadNonce,
	}

	return (
		<EditorStoreContext.Provider value={store}>
			{props.children}
		</EditorStoreContext.Provider>
	)
}

export function useEditorStore(): EditorStore {
	const ctx = useContext(EditorStoreContext)
	if (!ctx)
		throw new Error('useEditorStore must be used within EditorStoreProvider')
	return ctx
}
