import { onMount, onCleanup, createEffect, on } from 'solid-js'
import { css } from '../../../styled-system/css'
import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Slice } from '@tiptap/pm/model'
import { useEditorStore } from '../../stores/editor-store'
import { debounce } from '../../lib/debounce'
import { tiptapToPlaintext } from '../../lib/tiptap-to-plaintext'
import { hasListPatterns, parseLinesToNodes, cleanTipTapContent } from '../../lib/text-cleanup'

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

				// Only intercept plain text paste with list patterns
				if (html && html.trim()) return false
				if (!text || !hasListPatterns(text)) return false

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

// Store cursor positions per note ID
const cursorPositions = new Map<string, { from: number; to: number }>()

export function TipTapEditor(props: { note: Note; readonly?: boolean }) {
	let containerRef: HTMLDivElement | undefined
	let editor: Editor | null = null
	const editorStore = useEditorStore()
	let isUpdatingContent = false

	const debouncedSave = debounce(async (jsonContent: string) => {
		const plainText = tiptapToPlaintext(jsonContent)
		await editorStore.saveNote({
			content: jsonContent,
			content_plain: plainText,
		})
	}, 500)

	onMount(() => {
		editor = new Editor({
			element: containerRef!,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2, 3] },
				}),
				TaskList,
				TaskItem.configure({ nested: true }),
				Placeholder.configure({ placeholder: 'Start writing...' }),
				Underline,
				Highlight.configure({ multicolor: false }),
				Extension.create({
					name: 'searchHighlight',
					addProseMirrorPlugins: () => [createSearchPlugin()],
				}),
				Extension.create({
					name: 'pasteFormatter',
					addProseMirrorPlugins: () => [createPasteFormatterPlugin()],
				}),
			],
			content: parseContent(props.note.content),
			editable: !props.readonly,
			onUpdate: ({ editor: ed }) => {
				if (isUpdatingContent) return
				editorStore.setLivePreview(ed.getText().slice(0, 160))
				const json = JSON.stringify(ed.getJSON())
				debouncedSave(json)
			},
		})
		currentEditor = editor
		editor.view.dom.spellcheck = !!props.note.spellcheck

		// Prevent task checkboxes from stealing editor focus/cursor
		containerRef!.addEventListener('mousedown', (e) => {
			const target = e.target as HTMLElement
			if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
				e.preventDefault()
				// Toggle the checkbox via TipTap's command instead
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
	})

	// When the note changes (different note selected), update editor content
	let previousNoteId: string | null = null
	createEffect(
		on(
			() => props.note.id,
			(newId) => {
				if (editor) {
					// Save cursor position for the previous note
					if (previousNoteId) {
						const { from, to } = editor.state.selection
						cursorPositions.set(previousNoteId, { from, to })
					}

					debouncedSave.cancel()
					isUpdatingContent = true
					const content = parseContent(props.note.content)
					editor.commands.setContent(content)
					editor.setEditable(!props.readonly)
					isUpdatingContent = false

					// Restore cursor position for the new note (skip for new notes — title gets focus)
					if (!editorStore.isNewNote()) {
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
				}
				previousNoteId = newId
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

	// Apply spellcheck attribute directly on the ProseMirror contenteditable element
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
		if (editor) {
			editor.destroy()
			currentEditor = null
		}
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
