import { Show, onMount, createEffect, on, onCleanup } from 'solid-js'
import { AppStoreProvider, useAppStore } from '../stores/app-store'
import { EditorStoreProvider, useEditorStore } from '../stores/editor-store'
import { SettingsStoreProvider } from '../stores/settings-store'
import { SyncStoreProvider, useSyncStore } from '../stores/sync-store'
import { NoteListSync } from '../lib/list-sync'
import { TodoListSync } from '../lib/todo-sync'
import { AppShell } from './layout/AppShell'
import { SettingsDialog } from './settings/SettingsDialog'
import { CommandPalette } from './search/CommandPalette'

function AppInner() {
	const store = useAppStore()
	const editorStore = useEditorStore()
	const syncStore = useSyncStore()
	const activeListSyncs = new Map<string, NoteListSync>()
	const activeTodoListSyncs = new Map<string, TodoListSync>()

	// Handle remote unshare signals
	onMount(() => {
		syncStore.onUnshare(async (syncId: string) => {
			const notes = store.notes() || []
			const note = notes.find(n => n.sync_id === syncId)
			if (note) {
				await window.electronAPI.unshareNote(note.id)
				store.refetchNotes()
				const current = editorStore.currentNote()
				if (current?.id === note.id) {
					await editorStore.refreshCurrentNote()
				}
			}
		})
	})

	// Sync shared note lists — connect to Yjs for each shared list,
	// push/pull metadata and note membership
	createEffect(on(
		() => store.lists(),
		(lists) => {
			if (!lists) return
			const sharedLists = lists.filter(l => l.is_shared && l.sync_id && l.sync_secret)
			const activeSyncIds = new Set(sharedLists.map(l => l.sync_id!))

			// Cleanup syncs for lists that are no longer shared
			for (const [syncId, sync] of activeListSyncs) {
				if (!activeSyncIds.has(syncId)) {
					sync.destroy()
					syncStore.releaseDoc(syncId)
					activeListSyncs.delete(syncId)
				}
			}

			// Connect syncs for newly shared lists
			for (const list of sharedLists) {
				if (activeListSyncs.has(list.sync_id!)) continue

				const managed = syncStore.getDoc(list.sync_id!, list.sync_secret!)
				const listSync = new NoteListSync(managed.ydoc, list.id, () => {
					store.refetchLists()
					store.refetchNotes()
				})
				activeListSyncs.set(list.sync_id!, listSync)

				// If we have metadata, push it (we're the owner or have local data)
				if (list.name && list.name !== 'Shared List') {
					listSync.pushMeta(list.name, list.color, list.icon)

					// Push note membership
					const notes = (store.notes() || []).filter(
						n => n.list_id === list.id && n.sync_id && n.sync_secret && !n.is_trashed
					)
					listSync.pushNotes(notes.map(n => ({
						sync_id: n.sync_id!,
						sync_secret: n.sync_secret!,
						title: n.title,
					})))
				} else if (listSync.hasMeta()) {
					// We joined this list — apply remote metadata
					const meta = listSync.getRemoteMeta()
					if (meta) {
						window.electronAPI.updateList(list.id, meta).then(() => {
							store.refetchLists()
						})
					}
				}
			}
		}
	))

	// When notes change, push updated membership to all shared lists
	createEffect(on(
		() => store.notes(),
		(notes) => {
			if (!notes) return
			const lists = store.lists() || []
			for (const list of lists) {
				if (!list.is_shared || !list.sync_id) continue
				const listSync = activeListSyncs.get(list.sync_id)
				if (!listSync) continue
				if (list.name === 'Shared List') continue // Don't push from joiner

				const listNotes = notes.filter(
					n => n.list_id === list.id && n.sync_id && n.sync_secret && !n.is_trashed
				)
				listSync.pushNotes(listNotes.map(n => ({
					sync_id: n.sync_id!,
					sync_secret: n.sync_secret!,
					title: n.title,
				})))
			}
		},
		{ defer: true }
	))

	// Sync shared todo lists — connect to Yjs for each shared todo list on startup
	createEffect(on(
		() => store.todoLists(),
		(todoLists) => {
			if (!todoLists) return
			const sharedLists = todoLists.filter(l => l.is_shared && l.sync_id && l.sync_secret)
			const activeSyncIds = new Set(sharedLists.map(l => l.sync_id!))

			// Cleanup syncs for lists that are no longer shared
			for (const [syncId, sync] of activeTodoListSyncs) {
				if (!activeSyncIds.has(syncId)) {
					sync.destroy()
					syncStore.releaseDoc(syncId)
					activeTodoListSyncs.delete(syncId)
				}
			}

			// Connect syncs for newly shared lists
			for (const list of sharedLists) {
				if (activeTodoListSyncs.has(list.sync_id!)) continue

				const managed = syncStore.getDoc(list.sync_id!, list.sync_secret!)
				const todoSync = new TodoListSync(managed.ydoc, list.id, () => {
					store.refetchTodos()
				}, (meta) => {
					// Remote metadata changed — update local list
					window.electronAPI.updateTodoList(list.id, meta).then(() => {
						store.refetchTodoLists()
					})
				})
				activeTodoListSyncs.set(list.sync_id!, todoSync)

				if (list.is_owner) {
					// Owner — push metadata and local todos
					todoSync.pushMeta(list.name, list.color)
					window.electronAPI.fetchTodosByList(list.id).then(todos => {
						if (todos.length > 0) todoSync.pushLocal(todos)
					})
				} else {
					// Joiner — apply remote metadata and todos
					if (todoSync.hasMeta()) {
						const meta = todoSync.getRemoteMeta()
						if (meta) {
							window.electronAPI.updateTodoList(list.id, meta).then(() => {
								store.refetchTodoLists()
							})
						}
					}
					if (!todoSync.isEmpty()) {
						const remoteTodos = todoSync.getRemoteTodos()
						if (remoteTodos.length > 0) {
							window.electronAPI.syncTodosFromRemote(list.id, remoteTodos).then(() => {
								store.refetchTodos()
							})
						}
					}
				}
			}
		}
	))

	onCleanup(() => {
		for (const [, sync] of activeListSyncs) {
			sync.destroy()
		}
		activeListSyncs.clear()
		for (const [, sync] of activeTodoListSyncs) {
			sync.destroy()
		}
		activeTodoListSyncs.clear()
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
