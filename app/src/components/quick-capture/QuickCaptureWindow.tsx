import { createSignal } from 'solid-js'
import { css } from '../../../styled-system/css'

const container = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100vh',
	p: '4',
	bg: 'bg.default',
})

const header = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	mb: '3',
})

const headerTitle = css({
	fontSize: 'sm',
	fontWeight: '600',
	color: 'fg.default',
	letterSpacing: '-0.01em',
})

const headerHint = css({
	fontSize: '11px',
	color: 'fg.muted',
	fontFamily: 'mono',
})

const textarea = css({
	flex: 1,
	resize: 'none',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	borderRadius: 'lg',
	px: '3',
	py: '2.5',
	bg: 'bg.default',
	color: 'fg.default',
	fontSize: 'sm',
	outline: 'none',
	lineHeight: '1.7',
	transition: 'all 0.15s',
	_focus: { borderColor: 'indigo.a6', boxShadow: '0 0 0 3px {colors.indigo.a2}' },
	'&::placeholder': { color: 'fg.muted' },
})

const footer = css({
	display: 'flex',
	justifyContent: 'flex-end',
	mt: '3',
})

const saveBtn = css({
	px: '4',
	py: '2',
	borderRadius: 'lg',
	fontSize: 'sm',
	fontWeight: '500',
	cursor: 'pointer',
	bg: 'indigo.9',
	color: 'white',
	transition: 'all 0.15s',
	_hover: { bg: 'indigo.10' },
})

export default function QuickCaptureWindow() {
	const [text, setText] = createSignal('')

	async function handleSubmit() {
		const value = text().trim()
		if (!value) return
		await window.electronAPI.submitQuickCapture(value)
		setText('')
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			handleSubmit()
		}
		if (e.key === 'Escape') {
			window.close()
		}
	}

	return (
		<div class={container}>
			<div class={header}>
				<span class={headerTitle}>Quick Capture</span>
				<span class={headerHint}>Ctrl+Enter to save</span>
			</div>
			<textarea
				class={textarea}
				value={text()}
				onInput={(e) => setText(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
				placeholder="Jot something down..."
				autofocus
			/>
			<div class={footer}>
				<button class={saveBtn} onClick={handleSubmit}>
					Save Note
				</button>
			</div>
		</div>
	)
}
