import {
	createContext,
	useContext,
	createSignal,
	createEffect,
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
	saveNote: (data: {
		title?: string
		content?: string | null
		content_plain?: string | null
	}) => Promise<void>
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

	async function loadNote(id: string) {
		setLiveTitle(null)
		setLivePreview(null)
		const note = await window.electronAPI.fetchNote(id)
		if (note) setCurrentNote(note)
	}

	async function saveNote(data: {
		title?: string
		content?: string | null
		content_plain?: string | null
	}) {
		const note = currentNote()
		if (!note) return

		setIsSaving(true)
		await window.electronAPI.updateNote(note.id, data)
		await appStore.refetchNotes()
		setIsSaving(false)
	}

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
		saveNote,
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
