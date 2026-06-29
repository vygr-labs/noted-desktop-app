import { createSignal, createEffect, createMemo, on } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useEditorStore } from '../../stores/editor-store'
import { debounce } from '../../lib/debounce'

const textareaStyle = css({
	width: '100%',
	minHeight: '300px',
	flex: 1,
	resize: 'none',
	border: 'none',
	outline: 'none',
	bg: 'transparent',
	color: 'fg.default',
	fontSize: '15px',
	lineHeight: '1.8',
	fontFamily: 'sans-serif',
	letterSpacing: '-0.01em',
	mt: '2',
	'&::placeholder': { color: 'gray.a5' },
})

export function PlainTextEditor(props: { note: Note; readonly?: boolean }) {
	const editorStore = useEditorStore()
	const [text, setText] = createSignal(props.note.content_plain || props.note.content || '')

	// Saves to the note the edit was typed in (passed at call time) so a flush on
	// switch can't write the old note's text onto the newly-selected note.
	const debouncedSave = debounce(async (value: string, noteId: string) => {
		await editorStore.saveNote({
			content: value,
			content_plain: value,
		}, noteId)
	}, 500)

	// `createMemo` dedupes by ===, so this only fires on a genuine note switch.
	const noteId = createMemo(() => props.note.id)

	// When note changes, persist the previous note's last edits (to its own id)
	// then load the new note.
	createEffect(
		on(
			noteId,
			() => {
				debouncedSave.flush()
				setText(props.note.content_plain || props.note.content || '')
			},
			{ defer: true }
		)
	)

	// Adopt fresh content when the open note is reloaded after an external change.
	createEffect(
		on(
			() => editorStore.reloadNonce(),
			() => setText(props.note.content_plain || props.note.content || ''),
			{ defer: true }
		)
	)

	function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
		const value = e.currentTarget.value
		setText(value)
		editorStore.markDirty()
		editorStore.setLivePreview(value.slice(0, 160))
		debouncedSave(value, props.note.id)
	}

	return (
		<textarea
			class={textareaStyle}
			value={text()}
			onInput={handleInput}
			placeholder="Start writing..."
			disabled={props.readonly}
			spellcheck={!!props.note.spellcheck}
		/>
	)
}
