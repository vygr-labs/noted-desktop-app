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
import { useAppStore } from '../../stores/app-store'
import { useSettingsStore } from '../../stores/settings-store'
import { createCollabSession, type CollabSession } from '../../lib/collab'
import { ySyncPlugin, ySyncPluginKey, yCursorPlugin, yUndoPlugin } from 'y-prosemirror'
import { debounce } from '../../lib/debounce'
import { tiptapToPlaintext } from '../../lib/tiptap-to-plaintext'
import { hasListPatterns, hasTablePattern, hasMarkdownPatterns, parseLinesToNodes, parseMarkdownTable, cleanTipTapContent, alignLeftContent } from '../../lib/text-cleanup'
import { CodeBlockWithCopy } from './codeblock-with-copy'
import { DetailsBlock } from './details-block'
import { InlineCheckbox } from './inline-checkbox'

const editorWrap = css({
	minHeight: '200px',
	flex: 1,
	mt: '2',
	contain: 'content',
	'& .tiptap': {
		outline: 'none',
		minHeight: '200px',
		overflow: 'visible',
		paddingTop: '1.5em',
		animation: 'fade-in 0.15s ease-out',
	},
	'& .ProseMirror-yjs-cursor': {
		position: 'relative',
		borderLeft: '2px solid orange',
		marginLeft: '-1px',
		marginRight: '-1px',
		pointerEvents: 'none',
		wordBreak: 'normal',
	},
	'& .ProseMirror-yjs-cursor > div': {
		position: 'absolute',
		top: '-1.4em',
		left: '-2px',
		fontSize: '10px',
		fontWeight: '600',
		fontStyle: 'normal',
		color: 'white',
		padding: '1px 6px',
		borderRadius: '3px',
		whiteSpace: 'nowrap',
		lineHeight: '1.4',
		pointerEvents: 'none',
		userSelect: 'none',
		zIndex: 10,
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
	let collab: CollabSession | null = null
	const editorStore = useEditorStore()
	const appStore = useAppStore()
	const settings = useSettingsStore()
	let isUpdatingContent = false

	const debouncedSave = debounce(() => {
		if (!editor) return
		// Use requestIdleCallback to avoid blocking the main thread
		// during JSON serialization of large documents
		const cb = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : setTimeout
		cb(() => {
			if (!editor) return
			log('debouncedSave firing')
			const json = JSON.stringify(editor.getJSON())
			const plainText = tiptapToPlaintext(json)
			editorStore.saveNote({ content: json, content_plain: plainText })
		})
	}, 500)

	function getBaseExtensions(isCollab: boolean) {
		return [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				codeBlock: false,
				...(isCollab ? { undoRedo: false } : {}),
			}),
			CodeBlockWithCopy,
			DetailsBlock,
			InlineCheckbox,
			TaskList,
			TaskItem.configure({ nested: true }),
			Placeholder.configure({ placeholder: 'Start writing...' }),
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
		const dt0 = performance.now()
		log('destroyEditor', { hasCollab: !!collab, hasEditor: !!editor })
		if (collab) {
			// Save Yjs state before destroying
			if (collab.ydoc && props.note.sync_id) {
				try {
					const Y = collab.ydoc.constructor as any
					const state = Y.encodeStateAsUpdate
						? Y.encodeStateAsUpdate(collab.ydoc)
						: null
					// Fire and forget — save to local DB for offline resilience
					if (state) {
						window.electronAPI.saveYjsState(props.note.sync_id, state)
					}
				} catch { /* ignore */ }
			}
			collab.destroy()
			collab = null
		}
		if (editor) { editor.destroy(); editor = null }
		currentEditor = null
		log(`destroyEditor took: ${(performance.now() - dt0).toFixed(1)}ms`)
	}

	function setupCheckboxHandler() {
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

	function log(msg: string, ...args: unknown[]) {
		const t = new Date()
		const ts = t.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(t.getMilliseconds()).padStart(3, '0')
		console.log(`[${ts}][editor] ${msg}`, ...args)
	}

	function createEditorInstance(note: Note) {
		log('createEditorInstance', { id: note.id, sync_id: note.sync_id, is_owner: note.is_owner, hasContent: !!note.content, contentLen: note.content?.length || 0 })

		destroyEditor()
		if (!containerRef) return

		const isShared = !!(note.sync_id && note.sync_secret)

		if (isShared) {
			// ── Collaborative mode ──
			log('creating collab session', { syncId: note.sync_id })
			const serverUrl = settings.syncServerUrl()
			const authToken = settings.syncToken()

			collab = createCollabSession({
				syncId: note.sync_id!,
				syncSecret: note.sync_secret!,
				serverUrl,
				authToken: authToken || undefined,
				// Seeding local content happens in the `synced` handler below, once we
				// know whether the server already has state. Seeding here would merge
				// (concatenate) with any existing server state, duplicating the note.
			})

			log('collab created, fragment length:', collab.fragment.length)

			// Log provider events
			collab.provider.on('connect', () => log('provider: connected'))
			collab.provider.on('disconnect', () => log('provider: disconnected'))
			collab.provider.on('authenticationFailed', ({ reason }: any) => log('provider: auth failed', reason))

			const extensions = getBaseExtensions(true)
			extensions.push(Extension.create({
				name: 'yCollab',
				addProseMirrorPlugins: () => [
					ySyncPlugin(collab!.fragment),
					yCursorPlugin(collab!.awareness),
					yUndoPlugin(),
				],
			}))

			let collabReady = false
			editor = new Editor({
				element: containerRef,
				extensions,
				editable: !props.readonly,
				onCreate: () => {
					collabReady = true
					log('collab editor onCreate')
				},
				onUpdate: ({ editor: ed, transaction }) => {
					const isYjs = !!transaction.getMeta(ySyncPluginKey)
					log('collab onUpdate', { ready: collabReady, isYjs, textLen: ed.getText().length, docChanged: transaction.docChanged })
					if (!collabReady || isUpdatingContent) return
					if (isYjs) return
					editorStore.setLivePreview(ed.getText().slice(0, 160))
					debouncedSave()
				},
				onTransaction: ({ transaction }) => {
					const isYjs = !!transaction.getMeta(ySyncPluginKey)
					if (transaction.docChanged) {
						log('collab onTransaction docChanged', { isYjs })
					}
				},
				onTransaction: ({ editor: ed }) => {
					setInTable(ed.isActive('table'))
				},
			})

			log('collab editor created, editor text length:', editor.getText().length, 'fragment length:', collab.fragment.length)

			// Track content changes for debugging
			const debugEditor = editor
			const debugCollab = collab
			let debugCount = 0
			const debugInterval = setInterval(() => {
				if (!debugEditor || debugCount > 10) { clearInterval(debugInterval); return }
				log(`tick[${debugCount}]`, {
					editorText: debugEditor.getText().length,
					fragmentLen: debugCollab?.fragment?.length,
					isSynced: debugCollab?.provider?.isSynced,
				})
				debugCount++
			}, 500)

			// After initial sync: seed if server doc was empty, sync title, persist content
			const currentCollab = collab
			const currentEditor = editor
			collab.provider.on('synced', ({ state }: { state: boolean }) => {
				log('onSynced', { state, fragmentLength: currentCollab?.fragment?.length, editorTextLength: currentEditor?.getText()?.length, hasLocalContent: !!note.content })
				if (!state || !currentCollab || !currentEditor) return

				// Seed content if server doc is empty and we have local content
				if (note.content && currentCollab.fragment.length === 0) {
					log('seeding from local content (server was empty)')
					const tempExtensions = getBaseExtensions(true)
					tempExtensions.push(Extension.create({
						name: 'ySync',
						addProseMirrorPlugins: () => [ySyncPlugin(currentCollab.fragment)],
					}))
					const tempEditor = new Editor({ extensions: tempExtensions })
					tempEditor.commands.setContent(parseContent(note.content))
					tempEditor.destroy()
					log('seeding done, fragment length now:', currentCollab.fragment.length)
				} else {
					log('no seeding needed', { hasContent: !!note.content, fragmentLength: currentCollab.fragment.length })
				}

				// Title sync via _meta map
				const meta = currentCollab.ydoc.getMap('_meta')
				if (note.is_owner) {
					if (meta.get('title') !== note.title) {
						meta.set('title', note.title)
						log('owner pushed title:', note.title)
					}
				} else {
					const remoteTitle = meta.get('title') as string | undefined
					log('receiver title check', { remoteTitle, localTitle: note.title })
					if (remoteTitle && note.title === 'Shared Note') {
						editorStore.saveNote({ title: remoteTitle }).then(async () => {
							await editorStore.refreshCurrentNote()
							appStore.refetchNotes()
						})
					}
				}

				// Persist synced content for receiver (clears "Shared Note" state)
				if (currentEditor.getText().trim() && !note.content) {
					log('persisting synced content for receiver')
					const json = JSON.stringify(currentEditor.getJSON())
					const plainText = tiptapToPlaintext(json)
					editorStore.saveNote({ content: json, content_plain: plainText }).then(() => {
						editorStore.refreshCurrentNote()
					})
				}
			})
		} else {
			// ── Local mode ──
			// Create editor with empty content (fast ~50ms), then set real content.
			// This avoids the 600ms block from parsing large docs during construction.
			const t0 = performance.now()
			log('creating local editor (empty shell)')
			let editorReady = false
			editor = new Editor({
				element: containerRef,
				extensions: getBaseExtensions(false),
				content: '',
				editable: !props.readonly,
				onCreate: () => {
					editorReady = true
				},
				onUpdate: ({ editor: ed }) => {
					if (!editorReady || isUpdatingContent) return
					editorStore.setLivePreview(ed.getText().slice(0, 160))
					debouncedSave()
				},
				onTransaction: ({ editor: ed }) => {
					setInTable(ed.isActive('table'))
				},
			})
			const t1 = performance.now()
			log(`empty editor created: ${(t1 - t0).toFixed(1)}ms`)

			// Show plain text instantly, then swap to rich content in next frame
			if (note.content) {
				// Immediately show plain text as temporary content (instant, no parsing)
				if (note.content_plain) {
					isUpdatingContent = true
					editor.commands.setContent(`<p>${note.content_plain.slice(0, 3000).replace(/\n/g, '</p><p>')}</p>`)
					isUpdatingContent = false
					log('plain text preview set')
				}

				// Then parse and set the full rich content
				const editorRef = editor
				setTimeout(() => {
					if (!editorRef || editorRef !== editor) return
					const st = performance.now()
					isUpdatingContent = true
					editorRef.commands.setContent(parseContent(note.content))
					isUpdatingContent = false
					log(`setContent (deferred): ${(performance.now() - st).toFixed(1)}ms`)
				}, 0)
			}
		}

		currentEditor = editor
		setInTable(editor.isActive('table'))
		editor.view.dom.spellcheck = !!note.spellcheck
		setupCheckboxHandler()
		log('editor setup complete, text length:', editor.getText().length)

	}

	onMount(() => {
		log('onMount', { id: props.note.id, sync_id: props.note.sync_id })
		previousNoteId = props.note.id
		previousSyncId = props.note.sync_id || null
		createEditorInstance(props.note)
	})

	// When the note changes, recreate or update the editor
	let previousNoteId: string | null = null
	let previousSyncId: string | null = null
	createEffect(
		on(
			() => props.note.id,
			(newId) => {
				// Skip if same note (onMount already created it)
				if (newId === previousNoteId) {
					log('note.id effect: same note, skipping', { newId })
					return
				}
				log('note.id effect: switching', { from: previousNoteId, to: newId })

				if (previousNoteId && editor) {
					const { from, to } = editor.state.selection
					cursorPositions.set(previousNoteId, { from, to })
				}

				const note = props.note
				const newSyncId = note.sync_id || null

				// Must recreate if: switching to/from collab, or switching between different collab docs
				const needsRecreate = newSyncId !== previousSyncId || !!newSyncId

				debouncedSave.flush()
				if (needsRecreate) {
					createEditorInstance(note)
				} else if (editor) {
					// Local-to-local switch — update content in place (no destroy)
					// Set isUpdatingContent BEFORE setEditable because TipTap's
					// setEditable emits an 'update' event which triggers onUpdate
					// while the editor still has the OLD note's content loaded.
					isUpdatingContent = true
					editor.setEditable(!props.readonly)

					// Show plain text instantly, then swap to rich content
					if (note.content_plain && (note.content?.length || 0) > 50000) {
						editor.commands.setContent(`<p>${note.content_plain.slice(0, 3000).replace(/\n/g, '</p><p>')}</p>`)
						isUpdatingContent = false
						log('plain text preview set (switch)')

						const editorRef = editor
						setTimeout(() => {
							if (!editorRef || editorRef !== editor) return
							const st = performance.now()
							isUpdatingContent = true
							editorRef.commands.setContent(parseContent(note.content))
							isUpdatingContent = false
							log(`setContent (deferred switch): ${(performance.now() - st).toFixed(1)}ms`)
						}, 0)
					} else {
						const st = performance.now()
						editor.commands.setContent(parseContent(note.content))
						isUpdatingContent = false
						log(`setContent: ${(performance.now() - st).toFixed(1)}ms`)
					}
				}

				if (!note.sync_id && !editorStore.isNewNote()) {
					const saved = cursorPositions.get(newId)
					requestAnimationFrame(() => {
						if (editor) {
							const docSize = editor.state.doc.content.size
							const from = saved ? Math.min(saved.from, docSize) : docSize
							const to = saved ? Math.min(saved.to, docSize) : docSize
							const SelectionClass = editor.state.selection.constructor as any
							const tr = editor.state.tr.setSelection(
								SelectionClass.create(editor.state.doc, from, to)
							)
							editor.view.dispatch(tr)
							editor.view.focus()
						}
					})
				}

				previousNoteId = newId
				previousSyncId = newSyncId
			},
			{ defer: true }
		)
	)

	// Watch for sync_id changes on the same note (user clicks Share/Stop Sharing)
	createEffect(
		on(
			() => props.note.sync_id,
			(newSyncId) => {
				log('sync_id effect', { newSyncId, previousSyncId })
				if ((newSyncId || null) !== previousSyncId) {
					log('sync_id changed, recreating editor')
					debouncedSave.cancel()
					createEditorInstance(props.note)
					previousSyncId = newSyncId || null
				}
			},
			{ defer: true }
		)
	)

	// Owner: push title updates to Yjs _meta
	createEffect(
		on(
			() => props.note.title,
			(title) => {
				if (!collab || !props.note.is_owner) return
				const meta = collab.ydoc.getMap('_meta')
				if (meta.get('title') !== title) {
					meta.set('title', title)
				}
			},
			{ defer: true }
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
