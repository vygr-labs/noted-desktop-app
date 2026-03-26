import { css } from '../../../styled-system/css'
import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'

const container = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	py: '12',
	px: '4',
	textAlign: 'center',
	animation: 'slide-up-fade 0.3s ease-out',
})

const iconStyle = css({
	width: '12',
	height: '12',
	color: 'gray.a5',
	mb: '4',
	strokeWidth: '1.25',
})

const titleStyle = css({
	fontSize: 'md',
	fontWeight: '500',
	color: 'fg.subtle',
	mb: '1.5',
	letterSpacing: '-0.01em',
})

const descStyle = css({
	fontSize: 'sm',
	color: 'fg.muted',
	lineHeight: '1.5',
	maxWidth: '240px',
})

const hintStyle = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	fontSize: 'xs',
	color: 'fg.muted',
	mt: '4',
	bg: 'gray.a2',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a3',
	borderRadius: 'md',
	px: '2',
	py: '1',
	fontFamily: 'mono',
})

export function EmptyState(props: {
	icon: Component<{ class?: string }>
	title: string
	description: string
	hint?: string
	action?: JSX.Element
}) {
	return (
		<div class={container}>
			<props.icon class={iconStyle} />
			<p class={titleStyle}>{props.title}</p>
			<p class={descStyle}>{props.description}</p>
			<Show when={props.hint}>
				<span class={hintStyle}>{props.hint}</span>
			</Show>
			<Show when={props.action}>
				<div class={css({ mt: '4' })}>{props.action}</div>
			</Show>
		</div>
	)
}
