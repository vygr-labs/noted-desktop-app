import { onMount, onCleanup, createEffect, on, createSignal } from 'solid-js'
import { css } from '../../../styled-system/css'
import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Slice } from '@tiptap/pm/model'
import { useEditorStore } from '../../stores/editor-store'
import { useSyncStore } from '../../stores/sync-store'
import { debounce } from '../../lib/debounce'
import { tiptapToPlaintext } from '../../lib/tiptap-to-plaintext'
import { hasListPatterns, hasTablePattern, hasMarkdownPatterns, parseLinesToNodes, parseMarkdownTable, cleanTipTapContent, alignLeftContent } from '../../lib/text-cleanup'
import { CodeBlockWithCopy } from './codeblock-with-copy'
import { DetailsBlock } from './details-block'
import { InlineCheckbox } from './inline-checkbox'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'

const editorWrap = css({
	minHeight: '200px',
	flex: 1,
	mt: '2',
	'& .tiptap': {
		outline: 'none',
		minHeight: '200px',
	},
	'& .tiptap p.is-editor-empty:first-child::before': {
		content: 'attr(data-placeholder)',
		color: 'gray.a5',
		float: 'left',
		pointerEvents: 'none',
		height: 0,
	},
})

// Store editor instance globally so toolbar can access it
let currentEditor: Editor | null = null
export function getEditorInstance(): Editor | null {
	return currentEditor
}

// Reactive signal for whether cursor is inside a table
const [inTable, setInTable] = createSignal(false)
export function isInTable() { return inTable() }

// ─── Search plugin ───────────────────────────────────────

const searchPluginKey = new PluginKey('noteSearch')
let searchMatchPositions: { from: number; to: number }[] = []

function createSearchPlugin() {
	return new Plugin({
		key: searchPluginKey,
		state: {
			init() {
				return { query: '', currentIndex: 0 }
			},
			apply(tr, value) {
				const meta = tr.getMeta(searchPluginKey)
				if (meta !== undefined) return meta
				return value
			},
		},
		props: {
			decorations(state) {
				const { query, currentIndex } = searchPluginKey.getState(state) || { query: '', currentIndex: 0 }
				if (!query) return DecorationSet.empty

				const decorations: Decoration[] = []
				const lowerQuery = query.toLowerCase()
				let matchIdx = 0

				state.doc.descendants((node, pos) => {
					if (!node.isText) return
					const text = node.text!.toLowerCase()
					let idx = text.indexOf(lowerQuery)
					while (idx !== -1) {
						const from = pos + idx
						const to = from + query.length
						decorations.push(
							Decoration.inline(from, to, {
								class: matchIdx === currentIndex ? 'search-current' : 'search-match',
							})
						)
						matchIdx++
						idx = text.indexOf(lowerQuery, idx + 1)
					}
				})

				return DecorationSet.create(state.doc, decorations)
			},
		},
	})
}

export function searchInNote(query: string, currentIndex: number): number {
	searchMatchPositions = []
	if (!currentEditor || !query.trim()) {
		clearNoteSearch()
		return 0
	}

	const lowerQuery = query.toLowerCase()
	currentEditor.state.doc.descendants((node, pos) => {
		if (!node.isText) return
		const text = node.text!.toLowerCase()
		let idx = text.indexOf(lowerQuery)
		while (idx !== -1) {
			searchMatchPositions.push({ from: pos + idx, to: pos + idx + query.length })
			idx = text.indexOf(lowerQuery, idx + 1)
		}
	})

	const tr = currentEditor.state.tr.setMeta(searchPluginKey, { query, currentIndex })
	currentEditor.view.dispatch(tr)
	return searchMatchPositions.length
}

export function clearNoteSearch() {
	if (!currentEditor) return
	searchMatchPositions = []
	const tr = currentEditor.state.tr.setMeta(searchPluginKey, { query: '', currentIndex: 0 })
	currentEditor.view.dispatch(tr)
}

export function scrollToSearchMatch(index: number) {
	if (!currentEditor || index < 0 || index >= searchMatchPositions.length) return
	const { from } = searchMatchPositions[index]
	try {
		const domAtPos = currentEditor.view.domAtPos(from)
		const el = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement
		el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
	} catch {
		// Position may not be mappable — ignore
	}
}

export function replaceCurrentMatch(query: string, replacement: string, matchIndex: number): number {
	if (!currentEditor || matchIndex < 0 || matchIndex >= searchMatchPositions.length) return searchMatchPositions.length

	const { from, to } = searchMatchPositions[matchIndex]
	const { tr } = currentEditor.state
	tr.insertText(replacement, from, to)
	currentEditor.view.dispatch(tr)

	// Re-run search to update positions
	return searchInNote(query, Math.min(matchIndex, searchMatchPositions.length - 1))
}

export function replaceAllMatches(query: string, replacement: string): number {
	if (!currentEditor || searchMatchPositions.length === 0) return 0

	const { tr } = currentEditor.state
	// Replace in reverse order to keep positions valid
	for (let i = searchMatchPositions.length - 1; i >= 0; i--) {
		const { from, to } = searchMatchPositions[i]
		tr.insertText(replacement, from, to)
	}
	currentEditor.view.dispatch(tr)

	// Re-run search (should find 0 matches now)
	return searchInNote(query, 0)
}

// ─── Paste formatter plugin ──────────────────────────────

function createPasteFormatterPlugin() {
	return new Plugin({
		key: new PluginKey('pasteFormatter'),
		props: {
			handlePaste(view, event) {
				const clipboardData = event.clipboardData
				if (!clipboardData) return false

				const text = clipboardData.getData('text/plain')
				const html = clipboardData.getData('text/html')

				if (!text) return false

				// If HTML has proper list/table markup, let TipTap handle it natively
				if (html && html.trim()) {
					const hasHtmlLists = /<(ul|ol|table)\b/i.test(html)
					if (hasHtmlLists) return false
				}

				// Check if plain text has markdown patterns worth converting
				const hasList = hasListPatterns(text)
				const hasTable = hasTablePattern(text)
				const hasMd = hasMarkdownPatterns(text)
				if (!hasList && !hasTable && !hasMd) return false

				try {
					const lines = text.split('\n')
					const parsedNodes = parseLinesToNodes(lines)
					if (parsedNodes.length === 0) return false

					const { schema } = view.state
					const doc = schema.nodeFromJSON({
						type: 'doc',
						content: parsedNodes,
					})
					const slice = new Slice(doc.content, 0, 0)
					const tr = view.state.tr.replaceSelection(slice)
					view.dispatch(tr)
					return true
				} catch {
					// Fall back to default paste behavior
					return false
				}
			},
		},
	})
}

// ─── Clean content ───────────────────────────────────────

export function cleanEditorContent() {
	const editor = currentEditor
	if (!editor) return

	const json = editor.getJSON()
	const cleaned = cleanTipTapContent(json as any)
	editor.commands.setContent(cleaned)
}

export function alignEditorContent() {
	const editor = currentEditor
	if (!editor) return

	const { from, to, empty } = editor.state.selection

	if (empty) {
		// No selection — align entire document
		const json = editor.getJSON()
		const aligned = alignLeftContent(json as any)
		editor.commands.setContent(aligned)
		return
	}

	// Selection exists — strip leading whitespace from textblocks in range
	const { tr } = editor.state
	const deletions: { from: number; to: number }[] = []

	editor.state.doc.nodesBetween(from, to, (node, pos) => {
		if (!node.isTextblock) return
		const firstChild = node.firstChild
		if (firstChild?.isText && firstChild.text) {
			const match = firstChild.text.match(/^[\t ]+/)
			if (match) {
				const textStart = pos + 1
				deletions.push({ from: textStart, to: textStart + match[0].length })
			}
		}
	})

	// Apply in reverse to preserve positions
	for (let i = deletions.length - 1; i >= 0; i--) {
		tr.delete(deletions[i].from, deletions[i].to)
	}

	if (deletions.length > 0) {
		editor.view.dispatch(tr)
	}
}

// Store cursor positions per note ID
const cursorPositions = new Map<string, { from: number; to: number }>()

export function TipTapEditor(props: { note: Note; readonly?: boolean }) {
	let containerRef: HTMLDivElement | undefined
	let editor: Editor | null = null
	const editorStore = useEditorStore()
	const syncStore = useSyncStore()
	let isUpdatingContent = false
	let currentSyncId: string | null = null
	let activeSyncId: string | null = null // Track which sync doc we're using
	// Generation counter to detect stale async results after navigation
	let editorGeneration = 0

	const debouncedSave = debounce(async (jsonContent: string) => {
		const plainText = tiptapToPlaintext(jsonContent)
		await editorStore.saveNote({
			content: jsonContent,
			content_plain: plainText,
		})
	}, 500)

	function getBaseExtensions(isCollab: boolean) {
		return [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				codeBlock: false,
				...(isCollab ? { history: false } : {}),
			}),
			CodeBlockWithCopy,
			DetailsBlock,
			InlineCheckbox,
			TaskList,
			TaskItem.configure({ nested: true }),
			Placeholder.configure({ placeholder: 'Start writing...' }),
			Underline,
			Highlight.configure({ multicolor: false }),
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			Extension.create({
				name: 'searchHighlight',
				addProseMirrorPlugins: () => [createSearchPlugin()],
			}),
			Extension.create({
				name: 'pasteFormatter',
				addProseMirrorPlugins: () => [createPasteFormatterPlugin()],
			}),
		]
	}

	function destroyEditor() {
		// Release the sync doc (starts idle timer, doesn't destroy immediately)
		if (activeSyncId) {
			syncStore.releaseDoc(activeSyncId)
			activeSyncId = null
		}
		if (editor) { editor.destroy(); editor = null }
		currentEditor = null
	}

	/** Create a local-only editor (non-shared note, or placeholder while sync loads) */
	function createLocalEditor(note: Note, opts?: { readonly?: boolean }) {
		const extensions = getBaseExtensions(false)
		editor = new Editor({
			element: containerRef!,
			extensions,
			content: parseContent(note.content),
			editable: opts?.readonly ? false : !props.readonly,
			onUpdate: ({ editor: ed }) => {
				if (isUpdatingContent) return
				editorStore.setLivePreview(ed.getText().slice(0, 160))
				const json = JSON.stringify(ed.getJSON())
				debouncedSave(json)
			},
			onTransaction: ({ editor: ed }) => {
				setInTable(ed.isActive('table'))
			},
		})
		currentEditor = editor
		setInTable(editor.isActive('table'))
		editor.view.dom.spellcheck = !!note.spellcheck
		setupCheckboxHandler()
	}

	/** Create a collaborative editor backed by a synced Yjs doc */
	function createCollabEditor(note: Note, ydoc: Y.Doc) {
		const extensions = getBaseExtensions(true)
		extensions.push(Collaboration.configure({ document: ydoc }))

		editor = new Editor({
			element: containerRef!,
			extensions,
			content: undefined, // content comes from Yjs
			editable: !props.readonly,
			onUpdate: ({ editor: ed }) => {
				if (isUpdatingContent) return
				editorStore.setLivePreview(ed.getText().slice(0, 160))
				const json = JSON.stringify(ed.getJSON())
				debouncedSave(json)
			},
			onTransaction: ({ editor: ed }) => {
				setInTable(ed.isActive('table'))
			},
		})
		currentEditor = editor
		setInTable(editor.isActive('table'))
		editor.view.dom.spellcheck = !!note.spellcheck
		setupCheckboxHandler()

		// Persist synced content to DB so note.content gets populated
		// (clears "Syncing" state for joined notes)
		if (editor.getText().trim()) {
			const json = JSON.stringify(editor.getJSON())
			const plainText = tiptapToPlaintext(json)
			editorStore.saveNote({ content: json, content_plain: plainText })
		}
	}

	function setupCheckboxHandler() {
		// Prevent task checkboxes from stealing editor focus/cursor
		containerRef!.addEventListener('mousedown', (e) => {
			const target = e.target as HTMLElement
			if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
				e.preventDefault()
				const pos = editor?.view.posAtDOM(target, 0)
				if (pos != null && editor) {
					const resolved = editor.state.doc.resolve(pos)
					const node = resolved.nodeAfter ?? resolved.parent
					if (node?.type.name === 'taskItem') {
						editor.chain()
							.command(({ tr }) => {
								tr.setNodeMarkup(resolved.before(resolved.depth), undefined, {
									...node.attrs,
									checked: !node.attrs.checked,
								})
								return true
							})
							.run()
					}
				}
			}
		})
	}

	/**
	 * Two-phase editor creation for shared notes:
	 * Phase 1: Show local content in readonly mode immediately (no blank flash)
	 * Phase 2: Once sync is ready, recreate with Collaboration extension
	 *
	 * For non-shared notes, creates the editor synchronously.
	 */
	async function createEditorInstance(note: Note) {
		const gen = ++editorGeneration

		destroyEditor()
		if (!containerRef) return

		currentSyncId = note.sync_id || null

		// Non-shared note: create editor synchronously
		if (!note.sync_id || !note.sync_secret) {
			createLocalEditor(note)
			return
		}

		// -- Shared note: two-phase approach --

		// Phase 1: Show local content as readonly placeholder while sync loads
		createLocalEditor(note, { readonly: true })

		// Phase 2: Wait for sync doc to be ready
		try {
			const handle = await syncStore.getDoc(note.sync_id, note.sync_secret)

			// Stale guard: user navigated away while we were waiting
			if (gen !== editorGeneration) {
				syncStore.releaseDoc(note.sync_id)
				return
			}

			activeSyncId = note.sync_id

			// Seed if needed — safe because doc is in 'ready' state (post-sync).
			// If the server had content, fragment.length > 0 and we skip.
			// If the server was empty, we seed with local content.
			if (note.content) {
				const fragment = handle.ydoc.getXmlFragment('default')
				if (fragment.length === 0) {
					const tempExtensions = getBaseExtensions(true)
					tempExtensions.push(Collaboration.configure({ document: handle.ydoc }))
					const tempEditor = new Editor({ extensions: tempExtensions })
					tempEditor.commands.setContent(parseContent(note.content))
					tempEditor.destroy()
				}
			}

			// Destroy the placeholder editor (but NOT the sync doc)
			if (editor) { editor.destroy(); editor = null }
			currentEditor = null

			// Stale guard again after editor destruction
			if (gen !== editorGeneration || !containerRef) {
				syncStore.releaseDoc(note.sync_id)
				activeSyncId = null
				return
			}

			// Create the collaborative editor
			createCollabEditor(note, handle.ydoc)
		} catch (err) {
			// Sync failed — fall back to local-only editing
			console.error(`[editor] Sync failed for ${note.sync_id}:`, err)

			if (gen !== editorGeneration) return

			// Make the placeholder editor editable as fallback
			if (editor) {
				editor.setEditable(!props.readonly)
			}
		}
	}

	onMount(() => {
		createEditorInstance(props.note)
	})

	// When the note changes, recreate or update the editor
	let previousNoteId: string | null = null
	createEffect(
		on(
			() => props.note.id,
			(newId) => {
				if (previousNoteId && editor) {
					const { from, to } = editor.state.selection
					cursorPositions.set(previousNoteId, { from, to })
				}

				const note = props.note
				const newSyncId = note.sync_id || null

				if (newSyncId !== currentSyncId) {
					debouncedSave.cancel()
					createEditorInstance(note)
				} else if (editor) {
					debouncedSave.cancel()
					if (!note.sync_id) {
						isUpdatingContent = true
						editor.commands.setContent(parseContent(note.content))
						editor.setEditable(!props.readonly)
						isUpdatingContent = false
					} else {
						editor.setEditable(!props.readonly)
					}
				}

				if (!note.sync_id && !editorStore.isNewNote()) {
					const saved = cursorPositions.get(newId)
					requestAnimationFrame(() => {
						if (editor) {
							if (saved) {
								const docSize = editor.state.doc.content.size
								const from = Math.min(saved.from, docSize)
								const to = Math.min(saved.to, docSize)
								editor.commands.setTextSelection({ from, to })
							} else {
								editor.commands.setTextSelection(editor.state.doc.content.size)
							}
							editor.commands.focus()
						}
					})
				}

				previousNoteId = newId
			},
			{ defer: true }
		)
	)

	// Watch for sync_id changes on the SAME note (e.g., user clicks Share)
	createEffect(
		on(
			() => props.note.sync_id,
			(newSyncId) => {
				if ((newSyncId || null) !== currentSyncId) {
					debouncedSave.flush()
					createEditorInstance(props.note)
				}
			}
		)
	)

	createEffect(
		on(
			() => props.readonly,
			(readonly) => {
				if (editor) {
					editor.setEditable(!readonly)
				}
			}
		)
	)

	createEffect(
		on(
			() => props.note.spellcheck,
			(spellcheck) => {
				if (editor) {
					editor.view.dom.spellcheck = !!spellcheck
				}
			}
		)
	)

	onCleanup(() => {
		destroyEditor()
	})

	return <div ref={containerRef} class={editorWrap} />
}

function parseContent(content: string | null): Record<string, unknown> | string {
	if (!content) return ''
	try {
		return JSON.parse(content)
	} catch {
		return content
	}
}
