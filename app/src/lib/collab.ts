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
	/** Called after Y.Doc + fragment are created but BEFORE the provider connects.
	 *  Use this to seed the Yjs doc with local content for the owner's first share. */
	onBeforeConnect?: (ydoc: Y.Doc, fragment: Y.XmlFragment) => void
}): CollabSession {
	const ydoc = new Y.Doc()
	const fragment = ydoc.getXmlFragment('default')

	// Let caller seed content before the provider connects
	opts.onBeforeConnect?.(ydoc, fragment)

	// Build token: "authToken:docSecret" or just "docSecret"
	const token = opts.authToken
		? `${opts.authToken}:${opts.syncSecret}`
		: opts.syncSecret

	const provider = new HocuspocusProvider({
		url: opts.serverUrl,
		name: opts.syncId,
		document: ydoc,
		token,
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
