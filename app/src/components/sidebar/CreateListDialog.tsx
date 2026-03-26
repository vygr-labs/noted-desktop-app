import { createSignal } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'

const overlay = css({
	position: 'fixed',
	inset: 0,
	bg: 'rgba(0,0,0,0.5)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 50,
	animation: 'overlay-enter 0.15s ease-out',
})

const dialog = css({
	bg: 'gray.2',
	borderRadius: 'xl',
	p: '6',
	width: '360px',
	boxShadow: '0 24px 64px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px {colors.gray.a3}',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
})

const inputStyle = css({
	width: '100%',
	px: '3',
	py: '2',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	borderRadius: 'lg',
	bg: 'bg.default',
	color: 'fg.default',
	fontSize: 'sm',
	outline: 'none',
	transition: 'all 0.15s',
	_focus: { borderColor: 'indigo.a6', boxShadow: '0 0 0 3px {colors.indigo.a2}' },
})

const btnRow = css({
	display: 'flex',
	justifyContent: 'flex-end',
	gap: '2',
	mt: '5',
})

const cancelBtn = css({
	px: '4',
	py: '2',
	borderRadius: 'lg',
	fontSize: 'sm',
	fontWeight: '500',
	cursor: 'pointer',
	transition: 'all 0.15s',
	bg: 'gray.a3',
	color: 'fg.default',
	_hover: { bg: 'gray.a4' },
})

const createBtnStyle = css({
	px: '4',
	py: '2',
	borderRadius: 'lg',
	fontSize: 'sm',
	fontWeight: '500',
	cursor: 'pointer',
	transition: 'all 0.15s',
	bg: 'indigo.9',
	color: 'white',
	_hover: { bg: 'indigo.10' },
})

export function CreateListDialog(props: { onClose: () => void }) {
	const store = useAppStore()
	const [name, setName] = createSignal('')

	async function handleCreate() {
		const n = name().trim()
		if (!n) return
		await window.electronAPI.createList(n)
		store.refetchLists()
		props.onClose()
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleCreate()
		if (e.key === 'Escape') props.onClose()
	}

	return (
		<div class={overlay} onClick={props.onClose}>
			<div class={dialog} onClick={(e) => e.stopPropagation()}>
				<h3
					class={css({
						fontSize: 'md',
						fontWeight: '600',
						mb: '4',
						color: 'fg.default',
						letterSpacing: '-0.01em',
					})}
				>
					New List
				</h3>
				<input
					class={inputStyle}
					placeholder="List name"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
					onKeyDown={handleKeyDown}
					autofocus
				/>
				<div class={btnRow}>
					<button class={cancelBtn} onClick={props.onClose}>
						Cancel
					</button>
					<button class={createBtnStyle} onClick={handleCreate}>
						Create
					</button>
				</div>
			</div>
		</div>
	)
}
