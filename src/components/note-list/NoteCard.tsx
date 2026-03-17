import { Show } from 'solid-js'
import { css } from '../../../styled-system/css'
import { formatDate } from '../../lib/date-utils'
import { useEditorStore } from '../../stores/editor-store'
import { PinIcon } from 'lucide-solid'

const cardStyle = css({
	position: 'relative',
	display: 'flex',
	flexDirection: 'column',
	gap: '0.5',
	px: '4',
	py: '3',
	cursor: 'pointer',
	transition: 'background 0.12s ease',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a2',
	_hover: {
		bg: 'gray.a2',
	},
	'&[data-active="true"]': {
		bg: 'indigo.a2',
		'& .card-indicator': {
			opacity: 1,
			transform: 'scaleY(1)',
		},
	},
})

const indicator = css({
	position: 'absolute',
	left: 0,
	top: '15%',
	bottom: '15%',
	width: '3px',
	borderRadius: 'full',
	bg: 'indigo.9',
	opacity: 0,
	transform: 'scaleY(0)',
	transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
})

const titleRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
})

const titleText = css({
	fontSize: '13.5px',
	fontWeight: '600',
	color: 'fg.default',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	flex: 1,
	letterSpacing: '-0.01em',
})

const pinStyle = css({
	width: '3',
	height: '3',
	color: 'indigo.9',
	flexShrink: 0,
})

const previewText = css({
	fontSize: '12px',
	color: 'fg.muted',
	overflow: 'hidden',
	display: '-webkit-box',
	WebkitLineClamp: 2,
	WebkitBoxOrient: 'vertical',
	lineHeight: '1.55',
})

const metaText = css({
	fontSize: '11px',
	color: 'fg.subtle',
	fontWeight: '400',
	mt: '0.5',
})

export function NoteCard(props: {
	note: Note
	isActive: boolean
	onClick: () => void
	isTrash?: boolean
}) {
	const editorStore = useEditorStore()

	const title = () => {
		if (props.isActive) {
			const live = editorStore.liveTitle()
			if (live !== null) return live
		}
		return props.note.title || 'Untitled'
	}

	const preview = () => {
		if (props.isActive) {
			const live = editorStore.livePreview()
			if (live !== null) return live
		}
		const plain = props.note.content_plain
		if (plain) return plain.slice(0, 160)
		return ''
	}

	return (
		<div
			class={cardStyle}
			data-active={props.isActive}
			onClick={props.onClick}
		>
			<div class={`card-indicator ${indicator}`} />
			<div class={titleRow}>
				<span class={titleText}>{title()}</span>
				<Show when={props.note.is_pinned}>
					<PinIcon class={pinStyle} />
				</Show>
			</div>
			<Show when={preview()}>
				<div class={previewText}>{preview()}</div>
			</Show>
			<span class={metaText}>{formatDate(props.note.updated_at)}</span>
		</div>
	)
}
