import {
	createContext,
	useContext,
	onMount,
	onCleanup,
	createSignal,
	type ParentProps,
} from 'solid-js'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { useSettingsStore } from './settings-store'
import { DocStateMachine, type DocState } from '../lib/doc-state-machine'

interface SyncPeer {
	clientId: number
	name: string
	color: string
}

export interface ManagedDocHandle {
	ydoc: Y.Doc
	provider: HocuspocusProvider
	awareness: Awareness
	state: DocState
	onStateChange: (fn: (state: DocState, prev: DocState) => void) => () => void
}

interface SyncStore {
	/** Get or lazily create a Yjs doc + provider. Resolves when doc is ready (synced). */
	getDoc: (syncId: string, syncSecret: string) => Promise<ManagedDocHandle>
	/** Get the raw state machine synchronously (may not be ready yet). Null if not created. */
	getDocSync: (syncId: string) => DocStateMachine | null
	/** Release a doc (decrements refCount, starts idle timer if 0) */
	releaseDoc: (syncId: string) => void
	/** Destroy a specific doc immediately */
	destroyDoc: (syncId: string) => void
	/** Get current peers for a sync_id */
	getPeers: (syncId: string) => SyncPeer[]
	/** Reactive signal for peer updates */
	peersVersion: () => number
	/** Set local user info for awareness */
	setLocalUser: (name: string, color: string) => void
	/** Save all active Yjs states to local DB */
	saveAllStates: () => Promise<void>
	/** Signal to all peers that this doc is unshared, then destroy */
	signalUnshare: (syncId: string) => Promise<void>
	/** Register a callback for when a remote peer signals unshare */
	onUnshare: (callback: (syncId: string) => void) => void
}

const SyncStoreContext = createContext<SyncStore>()

const SAVE_INTERVAL = 30_000 // Save local state every 30 seconds

const PEER_COLORS = [
	'#e06c75', '#61afef', '#98c379', '#d19a66',
	'#c678dd', '#56b6c2', '#e5c07b', '#be5046',
]

export function SyncStoreProvider(props: ParentProps) {
	const settingsStore = useSettingsStore()
	const machines = new Map<string, DocStateMachine>()
	const [peersVersion, setPeersVersion] = createSignal(0)
	let localUser = { name: '', color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)] }
	let saveTimer: ReturnType<typeof setInterval> | null = null
	let unshareCallback: ((syncId: string) => void) | null = null

	// Load or generate a persistent device name
	onMount(async () => {
		let savedName = await window.electronAPI.getSetting('syncUserName')
		if (!savedName) {
			const id = Math.random().toString(36).slice(2, 6).toUpperCase()
			savedName = `User-${id}`
			await window.electronAPI.setSetting('syncUserName', savedName)
		}
		localUser.name = savedName
		// Update any already-connected awareness states
		for (const [, machine] of machines) {
			const awareness = machine.awareness
			if (awareness) {
				awareness.setLocalStateField('user', {
					name: localUser.name,
					color: localUser.color,
				})
			}
		}
	})

	function buildAuthToken(syncSecret: string): string {
		const globalToken = settingsStore.syncToken()
		return globalToken ? `${globalToken}:${syncSecret}` : syncSecret
	}

	function getOrCreateMachine(syncId: string, syncSecret: string): DocStateMachine {
		const existing = machines.get(syncId)
		if (existing && existing.state !== 'destroyed') {
			return existing
		}

		const machine = new DocStateMachine({
			syncId,
			syncSecret,
			serverUrl: settingsStore.syncServerUrl(),
			authToken: buildAuthToken(syncSecret),
			localUser: { ...localUser },
			loadLocal: (id) => window.electronAPI.loadYjsState(id),
			saveLocal: (id, state) => window.electronAPI.saveYjsState(id, state),
			onPeersChanged: () => setPeersVersion(v => v + 1),
			onUnshare: (id) => {
				machines.delete(id)
				unshareCallback?.(id)
			},
			onError: (id, error) => {
				console.error(`[sync-store] Doc ${id} error:`, error)
			},
		})

		machines.set(syncId, machine)
		return machine
	}

	function makeHandle(machine: DocStateMachine): ManagedDocHandle {
		return {
			ydoc: machine.ydoc,
			provider: machine.provider!,
			awareness: machine.awareness!,
			state: machine.state,
			onStateChange: (fn) => machine.onStateChange(fn),
		}
	}

	async function getDoc(syncId: string, syncSecret: string): Promise<ManagedDocHandle> {
		const machine = getOrCreateMachine(syncId, syncSecret)
		machine.acquire()

		// If already ready or idle (acquire brings it back to ready), return immediately
		if (machine.isReady) {
			return makeHandle(machine)
		}

		// Wait for the machine to reach ready state
		await machine.whenReady()
		return makeHandle(machine)
	}

	function getDocSync(syncId: string): DocStateMachine | null {
		const machine = machines.get(syncId)
		if (!machine || machine.state === 'destroyed') return null
		return machine
	}

	function releaseDoc(syncId: string) {
		const machine = machines.get(syncId)
		if (!machine) return
		machine.release()
	}

	function destroyDoc(syncId: string) {
		const machine = machines.get(syncId)
		if (!machine) return
		machine.destroy()
		machines.delete(syncId)
	}

	function getPeers(syncId: string): SyncPeer[] {
		const machine = machines.get(syncId)
		if (!machine) return []
		const awareness = machine.awareness
		if (!awareness) return []

		const peers: SyncPeer[] = []
		const states = awareness.getStates()
		const localClientId = awareness.clientID

		states.forEach((state, clientId) => {
			if (clientId === localClientId) return
			if (state.user) {
				peers.push({
					clientId,
					name: state.user.name || 'Anonymous',
					color: state.user.color || PEER_COLORS[clientId % PEER_COLORS.length],
				})
			}
		})

		return peers
	}

	function setLocalUser(name: string, color: string) {
		localUser = { name, color }
		for (const [, machine] of machines) {
			const awareness = machine.awareness
			if (awareness) {
				awareness.setLocalStateField('user', { name, color })
			}
		}
	}

	async function saveAllStates() {
		for (const [syncId, machine] of machines) {
			if (machine.state === 'destroyed') continue
			try {
				const state = Y.encodeStateAsUpdate(machine.ydoc)
				await window.electronAPI.saveYjsState(syncId, state)
			} catch (err) {
				console.error(`[sync-store] Failed to save state for ${syncId}:`, err)
			}
		}
	}

	async function signalUnshare(syncId: string): Promise<void> {
		const machine = machines.get(syncId)
		if (!machine || machine.state === 'destroyed') return

		// Write unshare flag — this syncs to all connected peers via Yjs
		const meta = machine.ydoc.getMap('_meta')
		meta.set('unshared', true)

		// Wait for the change to propagate (provider reports no unsynced changes)
		if (machine.provider && machine.provider.hasUnsyncedChanges) {
			await new Promise<void>((resolve) => {
				const timeout = setTimeout(resolve, 5000) // max wait 5s
				const unsub = machine.provider!.on('unsyncedChanges', () => {
					if (!machine.provider?.hasUnsyncedChanges) {
						clearTimeout(timeout)
						unsub?.()
						resolve()
					}
				})
			})
		}

		await machine.destroy()
		machines.delete(syncId)
	}

	function onUnshare(callback: (syncId: string) => void) {
		unshareCallback = callback
	}

	// Periodic save of all Yjs states for offline resilience
	onMount(() => {
		saveTimer = setInterval(() => {
			saveAllStates()
		}, SAVE_INTERVAL)
	})

	// Cleanup on unmount
	onCleanup(() => {
		if (saveTimer) clearInterval(saveTimer)
		for (const [, machine] of machines) {
			machine.destroy()
		}
		machines.clear()
	})

	const store: SyncStore = {
		getDoc,
		getDocSync,
		releaseDoc,
		destroyDoc,
		getPeers,
		signalUnshare,
		onUnshare,
		peersVersion,
		setLocalUser,
		saveAllStates,
	}

	return (
		<SyncStoreContext.Provider value={store}>
			{props.children}
		</SyncStoreContext.Provider>
	)
}

export function useSyncStore(): SyncStore {
	const ctx = useContext(SyncStoreContext)
	if (!ctx) throw new Error('useSyncStore must be used within SyncStoreProvider')
	return ctx
}
