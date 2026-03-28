import {
	createContext,
	useContext,
	onMount,
	onCleanup,
	createSignal,
	type ParentProps,
} from 'solid-js'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { useSettingsStore } from './settings-store'

interface SyncPeer {
	clientId: number
	name: string
	color: string
}

interface ManagedDoc {
	ydoc: Y.Doc
	provider: HocuspocusProvider
	awareness: Awareness
	lastAccess: number
}

interface SyncStore {
	/** Get or lazily create a Yjs doc + provider for a shared note */
	getDoc: (syncId: string, syncSecret: string) => ManagedDoc
	/** Release a doc (starts idle timer) */
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
	/** Pre-load local Yjs state for a doc before connecting */
	preloadState: (syncId: string) => Promise<Uint8Array | null>
	/** Signal to all peers that this doc is unshared, then destroy */
	signalUnshare: (syncId: string) => Promise<void>
	/** Register a callback for when a remote peer signals unshare */
	onUnshare: (callback: (syncId: string) => void) => void
}

const SyncStoreContext = createContext<SyncStore>()

const IDLE_TIMEOUT = 120_000 // 2 minutes before disconnecting unused docs
const SAVE_INTERVAL = 30_000 // Save local state every 30 seconds

const PEER_COLORS = [
	'#e06c75', '#61afef', '#98c379', '#d19a66',
	'#c678dd', '#56b6c2', '#e5c07b', '#be5046',
]

export function SyncStoreProvider(props: ParentProps) {
	const settingsStore = useSettingsStore()
	const docs = new Map<string, ManagedDoc>()
	const idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
	const [peersVersion, setPeersVersion] = createSignal(0)
	let localUser = { name: '', color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)] }
	let saveTimer: ReturnType<typeof setInterval> | null = null
	let unshareCallback: ((syncId: string) => void) | null = null

	// Load or generate a persistent device name
	onMount(async () => {
		let savedName = await window.electronAPI.getSetting('syncUserName')
		if (!savedName) {
			// Generate a name like "User-A3F2"
			const id = Math.random().toString(36).slice(2, 6).toUpperCase()
			savedName = `User-${id}`
			await window.electronAPI.setSetting('syncUserName', savedName)
		}
		localUser.name = savedName
		// Update any already-connected awareness states
		for (const [, managed] of docs) {
			managed.awareness.setLocalStateField('user', {
				name: localUser.name,
				color: localUser.color,
			})
		}
	})

	function buildAuthToken(syncSecret: string): string {
		const globalToken = settingsStore.syncToken()
		return globalToken ? `${globalToken}:${syncSecret}` : syncSecret
	}

	function getDoc(syncId: string, syncSecret: string): ManagedDoc {
		// Clear any idle timer
		const timer = idleTimers.get(syncId)
		if (timer) {
			clearTimeout(timer)
			idleTimers.delete(syncId)
		}

		const existing = docs.get(syncId)
		if (existing) {
			existing.lastAccess = Date.now()
			return existing
		}

		// Create new doc
		const ydoc = new Y.Doc()
		const provider = new HocuspocusProvider({
			url: settingsStore.syncServerUrl(),
			name: syncId,
			document: ydoc,
			token: buildAuthToken(syncSecret),
		})

		const awareness = provider.awareness!

		// Set local user awareness state
		awareness.setLocalStateField('user', {
			name: localUser.name,
			color: localUser.color,
		})

		// Listen for awareness changes to update peers
		awareness.on('change', () => {
			setPeersVersion(v => v + 1)
		})

		// Watch for remote unshare signal via Yjs shared map
		const meta = ydoc.getMap('_meta')
		meta.observe((event) => {
			if (meta.get('unshared') === true && unshareCallback) {
				unshareCallback(syncId)
				destroyDoc(syncId)
			}
		})

		const managed: ManagedDoc = { ydoc, provider, awareness, lastAccess: Date.now() }
		docs.set(syncId, managed)

		// Load local Yjs state for offline resilience
		loadLocalState(syncId, ydoc)

		return managed
	}

	async function loadLocalState(syncId: string, ydoc: Y.Doc) {
		try {
			const localState = await window.electronAPI.loadYjsState(syncId)
			if (localState) {
				Y.applyUpdate(ydoc, localState)
			}
		} catch {
			// No local state — start fresh
		}
	}

	function releaseDoc(syncId: string) {
		const existing = docs.get(syncId)
		if (!existing) return

		// Start idle timer
		const timer = setTimeout(() => {
			destroyDoc(syncId)
		}, IDLE_TIMEOUT)
		idleTimers.set(syncId, timer)
	}

	function destroyDoc(syncId: string) {
		const managed = docs.get(syncId)
		if (!managed) return

		// Save state before destroying
		try {
			const state = Y.encodeStateAsUpdate(managed.ydoc)
			window.electronAPI.saveYjsState(syncId, state)
		} catch { /* ignore */ }

		managed.provider.destroy()
		managed.ydoc.destroy()
		docs.delete(syncId)

		const timer = idleTimers.get(syncId)
		if (timer) {
			clearTimeout(timer)
			idleTimers.delete(syncId)
		}
	}

	function getPeers(syncId: string): SyncPeer[] {
		const managed = docs.get(syncId)
		if (!managed) return []

		const peers: SyncPeer[] = []
		const states = managed.awareness.getStates()
		const localClientId = managed.awareness.clientID

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
		// Update all active awareness states
		for (const [, managed] of docs) {
			managed.awareness.setLocalStateField('user', { name, color })
		}
	}

	async function saveAllStates() {
		for (const [syncId, managed] of docs) {
			try {
				const state = Y.encodeStateAsUpdate(managed.ydoc)
				await window.electronAPI.saveYjsState(syncId, state)
			} catch { /* ignore */ }
		}
	}

	async function preloadState(syncId: string): Promise<Uint8Array | null> {
		return window.electronAPI.loadYjsState(syncId)
	}

	async function signalUnshare(syncId: string): Promise<void> {
		const managed = docs.get(syncId)
		if (managed) {
			// Write unshare flag — this syncs to all connected peers via Yjs
			const meta = managed.ydoc.getMap('_meta')
			meta.set('unshared', true)
			// Wait for the signal to propagate before destroying
			await new Promise(resolve => setTimeout(resolve, 1000))
			destroyDoc(syncId)
		} else {
			destroyDoc(syncId)
		}
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

		// Save all states and destroy all connections
		for (const [syncId] of docs) {
			destroyDoc(syncId)
		}
	})

	const store: SyncStore = {
		getDoc,
		releaseDoc,
		destroyDoc,
		getPeers,
		signalUnshare,
		onUnshare,
		peersVersion,
		setLocalUser,
		saveAllStates,
		preloadState,
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
