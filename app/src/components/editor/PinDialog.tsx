import { createSignal } from 'solid-js'
import { css } from '../../../styled-system/css'

const backdrop = css({
	position: 'fixed',
	inset: 0,
	background: 'rgba(0,0,0,0.5)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 50,
	animation: 'fade-in 0.1s ease',
})

const dialog = css({
	bg: 'gray.2',
	borderRadius: 'xl',
	padding: '6',
	width: '340px',
	boxShadow: '0 24px 64px -8px rgba(0,0,0,0.4)',
	border: '1px solid',
	borderColor: 'gray.a3',
})

const titleStyle = css({
	fontSize: '16px',
	fontWeight: '600',
	color: 'fg.default',
	mb: '1',
})

const descStyle = css({
	fontSize: '13px',
	color: 'fg.muted',
	mb: '4',
})

const inputStyle = css({
	width: '100%',
	bg: 'gray.a2',
	border: '1px solid',
	borderColor: 'gray.a4',
	borderRadius: 'md',
	px: '3',
	py: '2.5',
	fontSize: '16px',
	fontFamily: 'mono',
	color: 'fg.default',
	textAlign: 'center',
	letterSpacing: '0.3em',
	outline: 'none',
	mb: '4',
	_focus: { borderColor: 'indigo.8' },
	'&::placeholder': { color: 'fg.subtle', letterSpacing: '0' },
})

const btnRow = css({
	display: 'flex',
	gap: '2',
	justifyContent: 'flex-end',
})

const cancelBtn = css({
	px: '4',
	py: '2',
	borderRadius: 'md',
	fontSize: '13px',
	cursor: 'pointer',
	color: 'fg.muted',
	_hover: { bg: 'gray.a3' },
})

const confirmBtn = css({
	px: '4',
	py: '2',
	borderRadius: 'md',
	fontSize: '13px',
	fontWeight: '500',
	cursor: 'pointer',
	bg: 'indigo.9',
	color: 'white',
	_hover: { bg: 'indigo.10' },
})

const errorStyle = css({
	fontSize: '12px',
	color: 'red.11',
	mb: '3',
	textAlign: 'center',
})

interface PinDialogProps {
	title: string
	description: string
	confirmLabel?: string
	minLength?: number
	onConfirm: (pin: string) => void | Promise<void>
	onCancel: () => void
}

export function PinDialog(props: PinDialogProps) {
	const [pin, setPin] = createSignal('')
	const [error, setError] = createSignal('')
	let inputRef: HTMLInputElement | undefined

	async function handleConfirm() {
		const value = pin().trim()
		const min = props.minLength ?? 4
		if (value.length < min) {
			setError(`PIN must be at least ${min} characters`)
			return
		}
		try {
			await props.onConfirm(value)
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Error')
		}
	}

	return (
		<div class={backdrop} onClick={props.onCancel}>
			<div class={dialog} onClick={(e) => e.stopPropagation()}>
				<div class={titleStyle}>{props.title}</div>
				<div class={descStyle}>{props.description}</div>
				{error() && <div class={errorStyle}>{error()}</div>}
				<input
					ref={(el) => { inputRef = el; requestAnimationFrame(() => el.focus()) }}
					class={inputStyle}
					type="password"
					value={pin()}
					onInput={(e) => { setPin(e.currentTarget.value); setError('') }}
					onKeyDown={(e) => {
						if (e.key === 'Enter') handleConfirm()
						if (e.key === 'Escape') props.onCancel()
					}}
					placeholder="Enter PIN"
					maxLength={20}
				/>
				<div class={btnRow}>
					<button class={cancelBtn} onClick={props.onCancel}>Cancel</button>
					<button class={confirmBtn} onClick={handleConfirm}>
						{props.confirmLabel || 'Confirm'}
					</button>
				</div>
			</div>
		</div>
	)
}
