/// <reference types="astro/client" />

interface Note {
	id: number
	title: string
	content: string | null
	created_at: string
	updated_at: string
}

interface ElectronAPI {
	ping: () => Promise<string>
	darkModeToggle: () => Promise<boolean>
	darkModeUpdate: (newTheme: 'light' | 'dark') => void
	darkModeSystem: () => void
	fetchAllNotes: () => Promise<Note[]>
	createNote: (title: string, content: string | null) => Promise<Note>
	updateNote: (id: number, title: string, content: string | null) => Promise<Note>
	deleteNote: (id: number) => Promise<void>
}

declare global {
	interface Window {
		electronAPI: ElectronAPI
	}
}
