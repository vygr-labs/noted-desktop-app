import * as Y from 'yjs'

interface SyncNoteMember {
	sync_id: string
	sync_secret: string
	title: string
}

/**
 * Syncs note list metadata (name, color, icon) and note membership
 * via a Yjs document. When the owner updates the list or adds/removes
 * notes, the changes propagate to all collaborators.
 */
export class NoteListSync {
	private meta: Y.Map<unknown>
	private notesArray: Y.Array<Y.Map<unknown>>
	private listId: string
	private isApplyingLocal = false
	private metaObserver: (() => void) | null = null
	private notesObserver: (() => void) | null = null
	private onRemoteChange: (() => void) | null = null

	constructor(
		private ydoc: Y.Doc,
		listId: string,
		onChange: () => void,
	) {
		this.listId = listId
		this.meta = ydoc.getMap('list_meta')
		this.notesArray = ydoc.getArray('list_notes')
		this.onRemoteChange = onChange

		// Watch for remote metadata changes
		this.metaObserver = () => {
			if (this.isApplyingLocal) return
			this.applyRemoteMeta()
		}
		this.meta.observe(this.metaObserver)

		// Watch for remote note membership changes
		this.notesObserver = () => {
			if (this.isApplyingLocal) return
			this.applyRemoteNotes()
		}
		this.notesArray.observeDeep(this.notesObserver)
	}

	/** Push list metadata to Yjs */
	pushMeta(name: string, color: string, icon: string) {
		this.isApplyingLocal = true
		this.ydoc.transact(() => {
			if (this.meta.get('name') !== name) this.meta.set('name', name)
			if (this.meta.get('color') !== color) this.meta.set('color', color)
			if (this.meta.get('icon') !== icon) this.meta.set('icon', icon)
		})
		this.isApplyingLocal = false
	}

	/** Push note membership to Yjs */
	pushNotes(notes: { sync_id: string; sync_secret: string; title: string }[]) {
		this.isApplyingLocal = true
		this.ydoc.transact(() => {
			// Build map of existing Yjs entries
			const yjsMap = new Map<string, { index: number; ymap: Y.Map<unknown> }>()
			for (let i = 0; i < this.notesArray.length; i++) {
				const ymap = this.notesArray.get(i)
				const syncId = ymap.get('sync_id') as string
				if (syncId) yjsMap.set(syncId, { index: i, ymap })
			}

			const noteMap = new Map(notes.map(n => [n.sync_id, n]))

			// Remove entries not in local
			const toDelete: number[] = []
			for (const [syncId, { index }] of yjsMap) {
				if (!noteMap.has(syncId)) toDelete.push(index)
			}
			for (let i = toDelete.length - 1; i >= 0; i--) {
				this.notesArray.delete(toDelete[i])
			}

			// Update or add
			for (const note of notes) {
				const existing = yjsMap.get(note.sync_id)
				if (existing) {
					if (existing.ymap.get('title') !== note.title) existing.ymap.set('title', note.title)
					if (existing.ymap.get('sync_secret') !== note.sync_secret) existing.ymap.set('sync_secret', note.sync_secret)
				} else {
					const ymap = new Y.Map<unknown>()
					ymap.set('sync_id', note.sync_id)
					ymap.set('sync_secret', note.sync_secret)
					ymap.set('title', note.title)
					this.notesArray.push([ymap])
				}
			}
		})
		this.isApplyingLocal = false
	}

	/** Apply remote metadata to local DB */
	private applyRemoteMeta() {
		const name = this.meta.get('name') as string
		const color = this.meta.get('color') as string
		const icon = this.meta.get('icon') as string
		if (name) {
			window.electronAPI.updateList(this.listId, { name, color, icon }).then(() => {
				this.onRemoteChange?.()
			})
		}
	}

	/** Apply remote note membership — create local note entries for new shared notes */
	private applyRemoteNotes() {
		const remoteNotes: SyncNoteMember[] = []
		for (let i = 0; i < this.notesArray.length; i++) {
			const ymap = this.notesArray.get(i)
			const syncId = ymap.get('sync_id') as string
			const syncSecret = ymap.get('sync_secret') as string
			const title = ymap.get('title') as string
			if (syncId && syncSecret) {
				remoteNotes.push({ sync_id: syncId, sync_secret: syncSecret, title: title || 'Shared Note' })
			}
		}

		// For each remote note, join it and link to this list
		Promise.all(remoteNotes.map(async (note) => {
			const code = `n:${note.sync_id}.${note.sync_secret}`
			await window.electronAPI.joinSharedNote(code, {
				list_id: this.listId,
				title: note.title,
			})
		})).then(() => {
			this.onRemoteChange?.()
		})
	}

	/** Get remote metadata */
	getRemoteMeta(): { name: string; color: string; icon: string } | null {
		const name = this.meta.get('name') as string
		if (!name) return null
		return {
			name,
			color: (this.meta.get('color') as string) || 'gray',
			icon: (this.meta.get('icon') as string) || 'folder',
		}
	}

	/** Check if Yjs has metadata */
	hasMeta(): boolean {
		return !!this.meta.get('name')
	}

	destroy() {
		if (this.metaObserver) {
			this.meta.unobserve(this.metaObserver)
			this.metaObserver = null
		}
		if (this.notesObserver) {
			this.notesArray.unobserveDeep(this.notesObserver)
			this.notesObserver = null
		}
		this.onRemoteChange = null
	}
}
