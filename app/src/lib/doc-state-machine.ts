import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import { syncLog } from './sync-log'

export type DocState = 'loading' | 'syncing' | 'ready' | 'idle' | 'error' | 'destroyed'

/** Transaction origin used when the owner signals unshare — the local observer should ignore this. */
export const UNSHARE_ORIGIN = Symbol('unshare-local')

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

		syncLog.info('doc', `${this.config.syncId} ${from} → ${to}`)
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
			syncLog.error('doc', `${this.config.syncId} failed to load local state:`, error)
			this.error = error
			this.config.onError?.(this.config.syncId, error)
			this.transition('error')
		}
	}

	// -- Private: syncing phase --

	private startSyncing(): void {
		if (this.state === 'destroyed') return
		this.transition('syncing')

		syncLog.info('doc', `${this.config.syncId} creating provider → ${this.config.serverUrl}`)

		// Create the provider AFTER local state is applied
		const provider = new HocuspocusProvider({
			url: this.config.serverUrl,
			name: this.config.syncId,
			document: this.ydoc,
			token: this.config.authToken,
			onSynced: ({ state }) => {
				syncLog.info('doc', `${this.config.syncId} onSynced state=${state}`)
				if (state) this.onProviderSynced()
			},
			onAuthenticationFailed: ({ reason }) => {
				this.onProviderAuthFailed(reason)
			},
		})

		this.provider = provider

		// Belt-and-suspenders: if the provider already synced during construction,
		// the config callback might have fired before we were ready. Check now.
		if (provider.isSynced && this.state === 'syncing') {
			syncLog.info('doc', `${this.config.syncId} already synced after construction`)
			this.onProviderSynced()
		}

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

		// Start sync timeout — if the server is slow/unreachable, proceed to
		// ready anyway using local state. The provider will keep reconnecting
		// in the background and sync when the server becomes available.
		this.syncTimer = setTimeout(() => {
			if (this.state === 'syncing') {
				if (provider.isSynced) {
					this.onProviderSynced()
					return
				}
				syncLog.warn('doc', `${this.config.syncId} sync timeout, proceeding with local state`)
				this.transition('ready')
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
		syncLog.error('doc', error.message)
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
		const observer = (event: Y.YMapEvent<unknown>) => {
			// Ignore the owner's own unshare signal (uses UNSHARE_ORIGIN)
			if (event.transaction.origin === UNSHARE_ORIGIN) return
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
			syncLog.error('doc', `${this.config.syncId} failed to save state:`, err)
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
