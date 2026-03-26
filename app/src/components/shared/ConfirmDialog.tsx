import { Show } from 'solid-js'
import { css } from '../../../styled-system/css'

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
	borderRadius: 'lg',
	p: '6',
	width: '360px',
	boxShadow: '0 24px 64px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px {colors.gray.a3}',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a3',
	animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
})

const titleStyle = css({
	fontSize: 'md',
	fontWeight: 'semibold',
	mb: '2',
	color: 'fg.default',
})

const descStyle = css({
	fontSize: 'sm',
	color: 'fg.subtle',
	mb: '4',
})

const btnRow = css({
	display: 'flex',
	justifyContent: 'flex-end',
	gap: '2',
})

const btn = css({
	px: '4',
	py: '1.5',
	borderRadius: 'md',
	fontSize: 'sm',
	fontWeight: 'medium',
	cursor: 'pointer',
	transition: 'all 0.15s',
})

export function ConfirmDialog(props: {
	open: boolean
	title: string
	description: string
	confirmLabel?: string
	onConfirm: () => void
	onCancel: () => void
	destructive?: boolean
}) {
	return (
		<Show when={props.open}>
			<div class={overlay} onClick={props.onCancel}>
				<div class={dialog} onClick={(e) => e.stopPropagation()}>
					<h3 class={titleStyle}>{props.title}</h3>
					<p class={descStyle}>{props.description}</p>
					<div class={btnRow}>
						<button
							class={`${btn} ${css({ bg: 'bg.muted', color: 'fg.default', _hover: { bg: 'bg.emphasized' } })}`}
							onClick={props.onCancel}
						>
							Cancel
						</button>
						<button
							class={`${btn} ${css({
								bg: props.destructive ? 'red.solid.bg' : 'colorPalette.solid.bg',
								color: props.destructive ? 'white' : 'colorPalette.solid.fg',
								_hover: {
									bg: props.destructive
										? 'red.solid.bg.hover'
										: 'colorPalette.solid.bg.hover',
								},
							})}`}
							onClick={props.onConfirm}
						>
							{props.confirmLabel || 'Confirm'}
						</button>
					</div>
				</div>
			</div>
		</Show>
	)
}
