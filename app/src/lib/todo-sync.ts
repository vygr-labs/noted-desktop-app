import * as Y from 'yjs'

// Serializable todo fields that get synced via Yjs
interface SyncTodo {
	id: string
	text: string
	description: string | null
	is_completed: number
	due_date: string | null
	sort_order: number
}

function todoToSync(todo: Todo): SyncTodo {
	return {
		id: todo.id,
		text: todo.text,
		description: todo.description,
		is_completed: todo.is_completed,
		due_date: todo.due_date,
		sort_order: todo.sort_order,
	}
}

function ymapToSync(ymap: Y.Map<unknown>): SyncTodo {
	return {
		id: ymap.get('id') as string,
		text: ymap.get('text') as string,
		description: (ymap.get('description') as string) || null,
		is_completed: (ymap.get('is_completed') as number) || 0,
		due_date: (ymap.get('due_date') as string) || null,
		sort_order: (ymap.get('sort_order') as number) || 0,
	}
}

function setYmapFromTodo(ymap: Y.Map<unknown>, todo: SyncTodo) {
	if (ymap.get('id') !== todo.id) ymap.set('id', todo.id)
	if (ymap.get('text') !== todo.text) ymap.set('text', todo.text)
	if (ymap.get('description') !== todo.description) ymap.set('description', todo.description)
	if (ymap.get('is_completed') !== todo.is_completed) ymap.set('is_completed', todo.is_completed)
	if (ymap.get('due_date') !== todo.due_date) ymap.set('due_date', todo.due_date)
	if (ymap.get('sort_order') !== todo.sort_order) ymap.set('sort_order', todo.sort_order)
}

/**
 * Manages bidirectional sync between local SQLite todos and a Yjs Y.Array
 * for a shared todo list. Also syncs list metadata (name, color).
 */
export class TodoListSync {
	private todosArray: Y.Array<Y.Map<unknown>>
	private meta: Y.Map<unknown>
	private listId: string
	private isApplyingRemote = false
	private isApplyingLocal = false
	private observer: ((event: Y.YArrayEvent<Y.Map<unknown>>) => void) | null = null
	private metaObserver: (() => void) | null = null
	private onRemoteChange: (() => void) | null = null
	private onMetaChange: ((meta: { name: string; color: string }) => void) | null = null

	constructor(
		private ydoc: Y.Doc,
		listId: string,
		onChange: () => void,
		onMetaChange?: (meta: { name: string; color: string }) => void,
	) {
		this.listId = listId
		this.todosArray = ydoc.getArray('todos')
		this.meta = ydoc.getMap('list_meta')
		this.onRemoteChange = onChange
		this.onMetaChange = onMetaChange || null

		// Watch for remote changes
		this.observer = () => {
			if (this.isApplyingLocal) return
			this.isApplyingRemote = true
			this.applyRemoteToLocal()
			this.isApplyingRemote = false
		}
		this.todosArray.observeDeep(this.observer)

		// Watch for remote metadata changes
		this.metaObserver = () => {
			if (this.isApplyingLocal) return
			const name = this.meta.get('name') as string
			const color = this.meta.get('color') as string
			if (name && this.onMetaChange) {
				this.onMetaChange({ name, color: color || 'gray' })
			}
		}
		this.meta.observe(this.metaObserver)
	}

	/** Push list metadata to Yjs */
	pushMeta(name: string, color: string) {
		this.isApplyingLocal = true
		this.ydoc.transact(() => {
			if (this.meta.get('name') !== name) this.meta.set('name', name)
			if (this.meta.get('color') !== color) this.meta.set('color', color)
		})
		this.isApplyingLocal = false
	}

	/** Get remote metadata */
	getRemoteMeta(): { name: string; color: string } | null {
		const name = this.meta.get('name') as string
		if (!name) return null
		return { name, color: (this.meta.get('color') as string) || 'gray' }
	}

	/** Check if Yjs has metadata */
	hasMeta(): boolean {
		return !!this.meta.get('name')
	}

	/** Push local todos to Yjs. Call after local SQLite changes. */
	pushLocal(todos: Todo[]) {
		if (this.isApplyingRemote) return

		this.isApplyingLocal = true
		this.ydoc.transact(() => {
			const localMap = new Map(todos.map(t => [t.id, todoToSync(t)]))
			const yjsMap = new Map<string, { index: number; ymap: Y.Map<unknown> }>()

			// Index existing Yjs items
			for (let i = 0; i < this.todosArray.length; i++) {
				const ymap = this.todosArray.get(i)
				const id = ymap.get('id') as string
				if (id) yjsMap.set(id, { index: i, ymap })
			}

			// Remove from Yjs anything not in local
			const toDelete: number[] = []
			for (const [id, { index }] of yjsMap) {
				if (!localMap.has(id)) toDelete.push(index)
			}
			// Delete in reverse order to preserve indices
			for (let i = toDelete.length - 1; i >= 0; i--) {
				this.todosArray.delete(toDelete[i])
			}

			// Update existing and add new
			for (const todo of todos) {
				const existing = yjsMap.get(todo.id)
				if (existing) {
					setYmapFromTodo(existing.ymap, todoToSync(todo))
				} else {
					const ymap = new Y.Map<unknown>()
					const sync = todoToSync(todo)
					for (const [k, v] of Object.entries(sync)) {
						ymap.set(k, v)
					}
					this.todosArray.push([ymap])
				}
			}
		})
		this.isApplyingLocal = false
	}

	/** Apply remote Yjs state to local SQLite. Called when Yjs changes from remote. */
	private applyRemoteToLocal() {
		const remoteTodos: SyncTodo[] = []
		for (let i = 0; i < this.todosArray.length; i++) {
			const ymap = this.todosArray.get(i)
			const id = ymap.get('id') as string
			if (id) {
				const todo = ymapToSync(ymap)
				todo.sort_order = i
				remoteTodos.push(todo)
			}
		}

		window.electronAPI.syncTodosFromRemote(this.listId, remoteTodos).then(() => {
			this.onRemoteChange?.()
		})
	}

	/** Get current Yjs todos (for initial merge check) */
	getRemoteTodos(): SyncTodo[] {
		const todos: SyncTodo[] = []
		for (let i = 0; i < this.todosArray.length; i++) {
			const ymap = this.todosArray.get(i)
			const id = ymap.get('id') as string
			if (id) todos.push(ymapToSync(ymap))
		}
		return todos
	}

	/** Check if Yjs has any todos */
	isEmpty(): boolean {
		return this.todosArray.length === 0
	}

	destroy() {
		if (this.observer) {
			this.todosArray.unobserveDeep(this.observer)
			this.observer = null
		}
		if (this.metaObserver) {
			this.meta.unobserve(this.metaObserver)
			this.metaObserver = null
		}
		this.onRemoteChange = null
		this.onMetaChange = null
	}
}
