import { Show } from 'solid-js'
import { AppStoreProvider, useAppStore } from '../stores/app-store'
import { EditorStoreProvider } from '../stores/editor-store'
import { SettingsStoreProvider } from '../stores/settings-store'
import { AppShell } from './layout/AppShell'
import { SettingsDialog } from './settings/SettingsDialog'
import { CommandPalette } from './search/CommandPalette'

function AppInner() {
	const store = useAppStore()

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
					<AppInner />
				</SettingsStoreProvider>
			</EditorStoreProvider>
		</AppStoreProvider>
	)
}
