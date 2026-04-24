/**
 * Lightweight collab session manager for a single shared note.
 * Creates a Y.Doc + HocuspocusProvider. No state machine — just create and destroy.
 */

import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'

export interface CollabSession {
	ydoc: Y.Doc
	provider: HocuspocusProvider
	awareness: Awareness
	fragment: Y.XmlFragment
	destroy: () => void
}

const PEER_COLORS = [
	'#6366f1', '#f59e0b', '#10b981', '#ef4444',
	'#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
]

export function createCollabSession(opts: {
	syncId: string
	syncSecret: string
	serverUrl: string
	authToken?: string
	userName?: string
	/** Optional loader for a locally-cached Yjs update. When provided, the provider
	 *  waits to connect until the update has been applied to the Y.Doc, so the
	 *  editor can render the cached content instantly. Applying a real Yjs update
	 *  is safe — Yjs merges by version vector, so the server's state will converge
	 *  cleanly without duplication. */
	loadCachedState?: (syncId: string) => Promise<Uint8Array | null> | Uint8Array | null
}): CollabSession {
	const ydoc = new Y.Doc()
	const fragment = ydoc.getXmlFragment('default')

	// Build token: "authToken:docSecret" or just "docSecret"
	const token = opts.authToken
		? `${opts.authToken}:${opts.syncSecret}`
		: opts.syncSecret

	const provider = new HocuspocusProvider({
		url: opts.serverUrl,
		name: opts.syncId,
		document: ydoc,
		token,
		connect: false,
	})

	// Apply locally-cached state (if any) before connecting to the server.
	const log = (msg: string, ...args: unknown[]) => console.log(`[collab] ${msg}`, ...args)
	log('loading cached yjs state', { syncId: opts.syncId })
	Promise.resolve(opts.loadCachedState?.(opts.syncId) ?? null)
		.then((cached) => {
			log('cached state loaded', {
				hasCache: !!cached,
				bytes: cached?.byteLength ?? 0,
				fragmentBefore: fragment.length,
			})
			if (cached && cached.byteLength > 0) {
				try {
					Y.applyUpdate(ydoc, cached)
					log('applied cached update', { fragmentAfter: fragment.length })
				} catch (e) {
					log('applyUpdate threw', e)
				}
			}
		})
		.catch((e) => log('cache load rejected', e))
		.finally(() => {
			log('connecting provider')
			provider.connect()
		})

	const awareness = provider.awareness!

	// Set local user for cursor display
	const color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
	const name = opts.userName || `User-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
	awareness.setLocalStateField('user', { name, color })

	function destroy() {
		provider.destroy()
		ydoc.destroy()
	}

	return { ydoc, provider, awareness, fragment, destroy }
}
