import { onMount, onCleanup, createEffect, on } from 'solid-js'
import { css } from '../../../styled-system/css'
import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditorStore } from '../../stores/editor-store'
import { debounce } from '../../lib/debounce'
import { createSearchPlugin, setActiveEditor, getEditorInstance } from './TipTapEditor'

// Plain-text notes render in the *same* TipTap editor engine as rich notes, so
// they share its layout, scrolling, scrollbar and typography — the only
// difference is that no formatting is ever applied. The text is loaded as one
// literal paragraph per line (no markdown parsing, so "- " / "# " / "**" stay
// verbatim), all input/paste rules are disabled so typing can't auto-format,
// and `white-space: pre-wrap` preserves indentation and runs of spaces.

const plainEditorWrap = css({
	minHeight: '200px',
	flex: 1,
	mt: '2',
	display: 'flex',
	flexDirection: 'column',
	'& .tiptap': {
		outline: 'none',
		flex: 1,
		minHeight: '200px',
		overflow: 'visible',
		paddingTop: '1.5em',
		// Preserve indentation / multiple spaces from the source file.
		whiteSpace: 'pre-wrap',
		animation: 'fade-in 0.15s ease-out',
	},
	// One paragraph per source line — drop the inter-block gap the rich editor
	// puts between paragraphs so lines are single-spaced like a plain-text file
	// (blank source lines remain as empty paragraphs, i.e. one blank line each).
	'& .tiptap > * + *': {
		marginTop: '0',
	},
	'& .tiptap p.is-editor-empty:first-child::before': {
		content: 'attr(data-placeholder)',
		color: 'gray.a5',
		float: 'left',
		pointerEvents: 'none',
		height: 0,
	},
})

interface DocTextNode {
	type: 'text'
	text: string
}
interface DocParagraph {
	type: 'paragraph'
	content?: DocTextNode[]
}

// Raw text → TipTap doc JSON: one paragraph per line, text kept verbatim. Empty
// lines become empty paragraphs so blank lines survive the round-trip.
function textToDoc(text: string): { type: 'doc'; content: DocParagraph[] } {
	const paras: DocParagraph[] = text.split(/\r?\n/).map((line) =>
		line.length > 0
			? { type: 'paragraph', content: [{ type: 'text', text: line }] }
			: { type: 'paragraph' }
	)
	return { type: 'doc', content: paras.length > 0 ? paras : [{ type: 'paragraph' }] }
}

export function PlainTextEditor(props: { note: Note; readonly?: boolean }) {
	let containerRef: HTMLDivElement | undefined
	let editor: Editor | null = null
	const editorStore = useEditorStore()
	// Guards content we set programmatically (load / external reload) so it
	// doesn't get treated as a user edit and echoed back to the store.
	let isUpdatingContent = false

	function noteText(note: Note): string {
		return note.content_plain || note.content || ''
	}

	// Serialize the document back to plain text with single newlines between
	// lines (TipTap's default block separator is a blank line, which would
	// double every newline on save).
	function currentText(): string {
		return editor ? editor.getText({ blockSeparator: '\n' }) : ''
	}

	// Saves to the note the edit was typed in (passed at call time) so a flush on
	// switch can't write the old note's text onto the newly-selected note.
	const debouncedSave = debounce((noteId: string) => {
		if (!editor) return
		const text = currentText()
		editorStore.saveNote({ content: text, content_plain: text }, noteId)
	}, 500)

	function createEditor(note: Note) {
		if (editor) {
			editor.destroy()
			editor = null
		}
		if (!containerRef) return

		editor = new Editor({
			element: containerRef,
			editable: !props.readonly,
			// No auto-formatting: a plain note must stay exactly as typed.
			enableInputRules: false,
			enablePasteRules: false,
			extensions: [
				// Formatting-free schema: only document / paragraph / text (plus
				// history, hardBreak, gap/drop cursors from StarterKit). Everything
				// that would turn text rich is excluded, so it can't be reached even
				// via keyboard shortcuts.
				StarterKit.configure({
					heading: false,
					bulletList: false,
					orderedList: false,
					listItem: false,
					blockquote: false,
					codeBlock: false,
					code: false,
					bold: false,
					italic: false,
					strike: false,
					horizontalRule: false,
					link: false,
					underline: false,
					// Keep the saved text exact — no auto-appended trailing paragraph.
					trailingNode: false,
				}),
				Placeholder.configure({ placeholder: 'Start writing...' }),
				// Same highlight plugin the rich editor uses, so in-note search
				// (Ctrl+F) highlights and navigates matches in plain notes too.
				Extension.create({
					name: 'searchHighlight',
					addProseMirrorPlugins: () => [createSearchPlugin()],
				}),
			],
			content: textToDoc(noteText(note)),
			onUpdate: () => {
				if (isUpdatingContent) return
				editorStore.markDirty()
				editorStore.setLivePreview(currentText().slice(0, 160))
				debouncedSave(props.note.id)
			},
		})
		editor.view.dom.spellcheck = !!note.spellcheck
		// Register as the active editor so the shared search helpers target it.
		setActiveEditor(editor)
	}

	onMount(() => createEditor(props.note))

	// Recreate the editor on a genuine note switch. Recreating (rather than
	// setContent) resets the undo history so it can't rewind into another note's
	// text; flush the previous note's pending save to its own id first.
	createEffect(
		on(
			() => props.note.id,
			() => {
				debouncedSave.flush()
				createEditor(props.note)
			},
			{ defer: true }
		)
	)

	// Adopt fresh content when the open note is reloaded after an external (CLI)
	// change. The store only bumps reloadNonce while the editor is idle.
	createEffect(
		on(
			() => editorStore.reloadNonce(),
			() => {
				if (!editor) return
				isUpdatingContent = true
				editor.commands.setContent(textToDoc(noteText(props.note)))
				isUpdatingContent = false
			},
			{ defer: true }
		)
	)

	createEffect(
		on(
			() => props.readonly,
			(readonly) => editor?.setEditable(!readonly),
			{ defer: true }
		)
	)

	createEffect(
		on(
			() => props.note.spellcheck,
			(spellcheck) => {
				if (editor) editor.view.dom.spellcheck = !!spellcheck
			},
			{ defer: true }
		)
	)

	onCleanup(() => {
		debouncedSave.flush()
		// Only clear the global if it still points at our editor — on a note-type
		// switch the incoming editor may have already registered itself.
		if (getEditorInstance() === editor) setActiveEditor(null)
		if (editor) {
			editor.destroy()
			editor = null
		}
	})

	return <div ref={containerRef} class={plainEditorWrap} />
}
