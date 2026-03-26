import { createSignal, createEffect, on } from 'solid-js'
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

	const debouncedSave = debounce(async (value: string) => {
		await editorStore.saveNote({
			content: value,
			content_plain: value,
		})
	}, 500)

	// When note changes, update content
	createEffect(
		on(
			() => props.note.id,
			() => {
				debouncedSave.cancel()
				setText(props.note.content_plain || props.note.content || '')
			},
			{ defer: true }
		)
	)

	function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
		const value = e.currentTarget.value
		setText(value)
		editorStore.setLivePreview(value.slice(0, 160))
		debouncedSave(value)
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
