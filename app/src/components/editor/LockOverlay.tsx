import { createSignal, Show, onMount } from 'solid-js'
import { css } from '../../../styled-system/css'
import { LockIcon, FingerprintIcon } from 'lucide-solid'

const overlay = css({
	position: 'absolute',
	inset: 0,
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	bg: 'bg.default',
	zIndex: 10,
	animation: 'fade-in 0.2s ease',
})

const lockIconWrap = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '16',
	height: '16',
	borderRadius: 'xl',
	bg: 'gray.a2',
	mb: '4',
})

const lockIconStyle = css({
	width: '7',
	height: '7',
	color: 'fg.subtle',
})

const title = css({
	fontSize: '16px',
	fontWeight: '600',
	color: 'fg.default',
	mb: '1',
})

const subtitle = css({
	fontSize: '13px',
	color: 'fg.muted',
	mb: '5',
})

const pinRow = css({
	display: 'flex',
	gap: '2',
	mb: '3',
})

const pinInput = css({
	width: '200px',
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
	transition: 'border-color 0.15s',
	_focus: { borderColor: 'indigo.8' },
	'&::placeholder': { color: 'fg.subtle', letterSpacing: '0' },
})

const unlockBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	px: '5',
	py: '2.5',
	borderRadius: 'md',
	fontSize: '13px',
	fontWeight: '500',
	cursor: 'pointer',
	bg: 'indigo.9',
	color: 'white',
	transition: 'background 0.15s',
	_hover: { bg: 'indigo.10' },
})

const biometricBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '2',
	mt: '3',
	px: '4',
	py: '2',
	borderRadius: 'md',
	fontSize: '13px',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const errorText = css({
	fontSize: '12px',
	color: 'red.11',
	mt: '2',
})

export function LockOverlay(props: { onUnlock: () => void }) {
	const [pin, setPin] = createSignal('')
	const [error, setError] = createSignal('')
	const [hasBiometric, setHasBiometric] = createSignal(false)
	let inputRef: HTMLInputElement | undefined

	onMount(async () => {
		setHasBiometric(await window.electronAPI.biometricAvailable())
		requestAnimationFrame(() => inputRef?.focus())
	})

	async function handlePinSubmit() {
		const value = pin().trim()
		if (!value) return

		const valid = await window.electronAPI.verifyLockPin(value)
		if (valid) {
			setError('')
			props.onUnlock()
		} else {
			setError('Incorrect PIN')
			setPin('')
			inputRef?.focus()
		}
	}

	async function handleBiometric() {
		const success = await window.electronAPI.biometricAuthenticate()
		if (success) {
			props.onUnlock()
		} else {
			setError('Biometric authentication failed')
		}
	}

	return (
		<div class={overlay}>
			<div class={lockIconWrap}>
				<LockIcon class={lockIconStyle} />
			</div>
			<div class={title}>This note is locked</div>
			<div class={subtitle}>Enter your PIN to view this note</div>
			<div class={pinRow}>
				<input
					ref={inputRef}
					class={pinInput}
					type="password"
					value={pin()}
					onInput={(e) => {
						setPin(e.currentTarget.value)
						setError('')
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter') handlePinSubmit()
					}}
					placeholder="PIN"
					maxLength={20}
				/>
				<button class={unlockBtn} onClick={handlePinSubmit}>
					Unlock
				</button>
			</div>
			<Show when={error()}>
				<div class={errorText}>{error()}</div>
			</Show>
			<Show when={hasBiometric()}>
				<button class={biometricBtn} onClick={handleBiometric}>
					<FingerprintIcon class={css({ width: '4', height: '4' })} />
					Use fingerprint
				</button>
			</Show>
		</div>
	)
}
