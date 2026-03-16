/* eslint-disable @typescript-eslint/no-var-requires */
// Electron doesnt support ESM for renderer process. Alternatively, pass this file
// through a bundler but that feels like an overkill
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
	// Sample
	ping: () => ipcRenderer.invoke('sample:ping'),

	// Dark mode
	darkModeToggle: () => ipcRenderer.invoke('dark-mode:toggle'),
	darkModeUpdate: (newTheme: 'light' | 'dark') =>
		ipcRenderer.send('dark-mode:update', newTheme),
	darkModeSystem: () => ipcRenderer.send('dark-mode:system'),

	// Notes CRUD
	fetchAllNotes: () => ipcRenderer.invoke('notes:fetch-all'),
	createNote: (title: string, content: string | null) =>
		ipcRenderer.invoke('notes:create', title, content),
	updateNote: (id: number, title: string, content: string | null) =>
		ipcRenderer.invoke('notes:update', id, title, content),
	deleteNote: (id: number) => ipcRenderer.invoke('notes:delete', id),
})
