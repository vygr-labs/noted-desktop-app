import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

export type DocState = 'loading' | 'syncing' | 'ready' | 'idle' | 'error' | 'destroyed'

type StateListener = (state: DocState, prev: DocState) => void

export interface DocStateMachineConfig {
	syncId: string
	syncSecret: string
	serverUrl: string
	authToken: string
	localUser: { name: string; color: string }
	loadLocal: (syncId: string) => Promise<Uint8Array | null>
	saveLocal: (syncId: string, state: Uint8Array) => Promise<void>
	onPeersChanged: () => void
	onUnshare: (syncId: string) => void
	onError?: (syncId: string, error: Error) => void
	syncTimeout?: number
	idleTimeout?: number
}

const DEFAULT_SYNC_TIMEOUT = 15_000
const DEFAULT_IDLE_TIMEOUT = 120_000

/**
 * Manages the lifecycle of a single synced Yjs document.
 *
 * States: loading → syncing → ready ⇄ idle → destroyed
 *                                ↓           ↓
 *                              error ←------┘
 *
 * - loading: local Yjs state is being read from SQLite. No provider yet.
 * - syncing: provider created & connecting.
 * - ready:   synced with server. Edits safe.
 * - idle:    released by all consumers, idle timer running.
 * - error:   something failed. Can retry() or destroy().
 * - destroyed: terminal. Provider and doc torn down.
 */
export class DocStateMachine {
	state: DocState = 'loading'
	ydoc: Y.Doc
	provider: HocuspocusProvider | null = null
	error: Error | null = null
	refCount = 0
	lastAccess: number = Date.now()

	private config: Required<Pick<DocStateMachineConfig, 'syncTimeout' | 'idleTimeout'>> & DocStateMachineConfig
	private listeners = new Set<StateListener>()
	private idleTimer: ReturnType<typeof setTimeout> | null = null
	private syncTimer: ReturnType<typeof setTimeout> | null = null
	private metaObserverDispose: (() => void) | null = null
	private _readyPromise: Promise<void>
	private _readyResolve!: () => void
	private _readyReject!: (err: Error) => void

	constructor(config: DocStateMachineConfig) {
		this.config = {
			...config,
			syncTimeout: config.syncTimeout ?? DEFAULT_SYNC_TIMEOUT,
			idleTimeout: config.idleTimeout ?? DEFAULT_IDLE_TIMEOUT,
		}

		this.ydoc = new Y.Doc()

		// Promise that resolves when the doc reaches 'ready' state
		this._readyPromise = new Promise<void>((resolve, reject) => {
			this._readyResolve = resolve
			this._readyReject = reject
		})

		this.startLoading()
	}

	// -- Public API --

	get awareness(): Awareness | null {
		return this.provider?.awareness ?? null
	}

	get isReady(): boolean {
		return this.state === 'ready'
	}

	get syncId(): string {
		return this.config.syncId
	}

	/** Wait until the doc reaches 'ready' state. Rejects on error/destroyed. */
	whenReady(): Promise<void> {
		if (this.state === 'ready' || this.state === 'idle') return Promise.resolve()
		if (this.state === 'destroyed') return Promise.reject(new Error('Doc is destroyed'))
		if (this.state === 'error') return Promise.reject(this.error ?? new Error('Doc in error state'))
		return this._readyPromise
	}

	/** Increment refCount. If idle, return to ready. */
	acquire(): void {
		if (this.state === 'destroyed') throw new Error(`Cannot acquire destroyed doc ${this.config.syncId}`)
		this.refCount++
		this.lastAccess = Date.now()

		if (this.state === 'idle') {
			this.clearIdleTimer()
			this.transition('ready')
		}
	}

	/** Decrement refCount. If 0, start idle timer. */
	release(): void {
		if (this.refCount > 0) this.refCount--

		if (this.refCount === 0 && this.state === 'ready') {
			this.transition('idle')
			this.startIdleTimer()
		}
	}

	/** Retry from error state — restarts the loading flow. */
	retry(): void {
		if (this.state !== 'error') return
		this.error = null

		// Rebuild the ready promise for new waiters
		this._readyPromise = new Promise<void>((resolve, reject) => {
			this._readyResolve = resolve
			this._readyReject = reject
		})

		this.transition('loading')
		this.startLoading()
	}

	/** Save state and tear everything down. */
	async destroy(): Promise<void> {
		if (this.state === 'destroyed') return

		this.clearIdleTimer()
		this.clearSyncTimer()

		// Save state before destroying
		await this.saveState()

		this.cleanupProvider()
		this.ydoc.destroy()
		this.transition('destroyed')

		// Reject any pending waiters
		this._readyReject(new Error('Doc destroyed'))
	}

	/** Subscribe to state transitions. Returns unsubscribe function. */
	onStateChange(fn: StateListener): () => void {
		this.listeners.add(fn)
		return () => this.listeners.delete(fn)
	}

	// -- Private: state transitions --

	private transition(to: DocState): void {
		const from = this.state
		if (from === to) return
		if (from === 'destroyed') return // terminal

		this.state = to
		for (const fn of this.listeners) {
			try { fn(to, from) } catch { /* listener errors shouldn't break the machine */ }
		}

		// Resolve/reject the ready promise on relevant transitions
		if (to === 'ready') {
			this._readyResolve()
		} else if (to === 'error') {
			this._readyReject(this.error ?? new Error('Doc entered error state'))
		} else if (to === 'destroyed') {
			this._readyReject(new Error('Doc destroyed'))
		}
	}

	// -- Private: loading phase --

	private async startLoading(): Promise<void> {
		this.transition('loading')

		try {
			const localState = await this.config.loadLocal(this.config.syncId)
			if (this.state === 'destroyed') return // destroyed while loading

			if (localState) {
				Y.applyUpdate(this.ydoc, localState)
			}

			this.startSyncing()
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err))
			console.error(`[sync] Failed to load local state for ${this.config.syncId}:`, error)
			this.error = error
			this.config.onError?.(this.config.syncId, error)
			this.transition('error')
		}
	}

	// -- Private: syncing phase --

	private startSyncing(): void {
		if (this.state === 'destroyed') return
		this.transition('syncing')

		// Create the provider AFTER local state is applied
		const provider = new HocuspocusProvider({
			url: this.config.serverUrl,
			name: this.config.syncId,
			document: this.ydoc,
			token: this.config.authToken,
			onSynced: ({ state }) => {
				if (state) this.onProviderSynced()
			},
			onAuthenticationFailed: ({ reason }) => {
				this.onProviderAuthFailed(reason)
			},
			onUnsyncedChanges: () => {
				// Only used for signalUnshare flow; no-op here
			},
		})

		this.provider = provider

		// Set awareness
		const awareness = provider.awareness
		if (awareness) {
			awareness.setLocalStateField('user', {
				name: this.config.localUser.name,
				color: this.config.localUser.color,
			})
			awareness.on('change', () => {
				this.config.onPeersChanged()
			})
		}

		// Watch for remote unshare signal
		this.setupUnshareListener()

		// Start sync timeout
		this.syncTimer = setTimeout(() => {
			if (this.state === 'syncing') {
				// Provider already synced while we were setting up? Check.
				if (provider.isSynced) {
					this.onProviderSynced()
					return
				}
				const error = new Error(`Sync timeout for ${this.config.syncId} (${this.config.syncTimeout}ms)`)
				console.error(`[sync] ${error.message}`)
				this.error = error
				this.config.onError?.(this.config.syncId, error)
				this.transition('error')
			}
		}, this.config.syncTimeout)
	}

	private onProviderSynced(): void {
		if (this.state !== 'syncing') return
		this.clearSyncTimer()
		this.transition('ready')
	}

	private onProviderAuthFailed(reason: string): void {
		if (this.state === 'destroyed') return
		this.clearSyncTimer()
		const error = new Error(`Authentication failed for ${this.config.syncId}: ${reason}`)
		console.error(`[sync] ${error.message}`)
		this.error = error
		this.config.onError?.(this.config.syncId, error)
		this.transition('error')
	}

	// -- Private: idle management --

	private startIdleTimer(): void {
		this.clearIdleTimer()
		this.idleTimer = setTimeout(() => {
			if (this.state === 'idle') {
				this.destroy()
			}
		}, this.config.idleTimeout)
	}

	private clearIdleTimer(): void {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer)
			this.idleTimer = null
		}
	}

	private clearSyncTimer(): void {
		if (this.syncTimer) {
			clearTimeout(this.syncTimer)
			this.syncTimer = null
		}
	}

	// -- Private: unshare listener --

	private setupUnshareListener(): void {
		const meta = this.ydoc.getMap('_meta')
		const observer = () => {
			if (meta.get('unshared') === true) {
				this.config.onUnshare(this.config.syncId)
				this.destroy()
			}
		}
		meta.observe(observer)
		this.metaObserverDispose = () => meta.unobserve(observer)
	}

	// -- Private: persistence --

	private async saveState(): Promise<void> {
		try {
			const state = Y.encodeStateAsUpdate(this.ydoc)
			await this.config.saveLocal(this.config.syncId, state)
		} catch (err) {
			console.error(`[sync] Failed to save state for ${this.config.syncId}:`, err)
		}
	}

	// -- Private: cleanup --

	private cleanupProvider(): void {
		if (this.metaObserverDispose) {
			this.metaObserverDispose()
			this.metaObserverDispose = null
		}
		if (this.provider) {
			this.provider.destroy()
			this.provider = null
		}
	}
}
