import { Show, onMount } from 'solid-js'
import { AppStoreProvider, useAppStore } from '../stores/app-store'
import { EditorStoreProvider, useEditorStore } from '../stores/editor-store'
import { SettingsStoreProvider } from '../stores/settings-store'
import { SyncStoreProvider, useSyncStore } from '../stores/sync-store'
import { AppShell } from './layout/AppShell'
import { SettingsDialog } from './settings/SettingsDialog'
import { CommandPalette } from './search/CommandPalette'

function AppInner() {
	const store = useAppStore()
	const editorStore = useEditorStore()
	const syncStore = useSyncStore()

	// Handle remote unshare signals — auto-unshare the note locally
	onMount(() => {
		syncStore.onUnshare(async (syncId: string) => {
			// Find the local note with this sync_id and unshare it
			const notes = store.notes() || []
			const note = notes.find(n => n.sync_id === syncId)
			if (note) {
				await window.electronAPI.unshareNote(note.id)
				store.refetchNotes()
				// If this note is currently open, refresh it
				const current = editorStore.currentNote()
				if (current?.id === note.id) {
					await editorStore.refreshCurrentNote()
				}
			}
		})
	})

	return (
		<>
			<AppShell />
			<SettingsDialog />
			<Show when={store.commandPaletteOpen()}>
				<CommandPalette />
			</Show>
		</>
	)
}

export default function App() {
	return (
		<AppStoreProvider>
			<EditorStoreProvider>
				<SettingsStoreProvider>
					<SyncStoreProvider>
						<AppInner />
					</SyncStoreProvider>
				</SettingsStoreProvider>
			</EditorStoreProvider>
		</AppStoreProvider>
	)
}
