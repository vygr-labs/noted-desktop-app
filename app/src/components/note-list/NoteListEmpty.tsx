import { Show } from 'solid-js'
import { css } from '../../../styled-system/css'
import { FileTextIcon, Trash2Icon } from 'lucide-solid'
import { getGreeting } from '../../lib/date-utils'

const emptyStyle = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	py: '16',
	px: '6',
	textAlign: 'center',
	animation: 'fade-in 0.3s ease-out',
})

const iconStyle = css({
	width: '10',
	height: '10',
	color: 'gray.a4',
	mb: '4',
	strokeWidth: '1.25',
})

const titleStyle = css({
	fontSize: 'sm',
	fontWeight: '600',
	color: 'fg.subtle',
	mb: '1',
	letterSpacing: '-0.01em',
})

const descStyle = css({
	fontSize: 'xs',
	color: 'fg.muted',
	mb: '5',
	lineHeight: '1.5',
	maxWidth: '200px',
})

const createBtn = css({
	px: '4',
	py: '2',
	borderRadius: 'md',
	fontSize: 'xs',
	fontWeight: '500',
	cursor: 'pointer',
	bg: 'indigo.9',
	color: 'white',
	transition: 'all 0.15s',
	_hover: { bg: 'indigo.10' },
	_active: { transform: 'scale(0.98)' },
})

export function NoteListEmpty(props: {
	isTrash: boolean
	onCreateNote: () => void
}) {
	return (
		<div class={emptyStyle}>
			<Show
				when={!props.isTrash}
				fallback={
					<>
						<Trash2Icon class={iconStyle} />
						<p class={titleStyle}>Trash is empty</p>
						<p class={descStyle}>Deleted notes will appear here</p>
					</>
				}
			>
				<FileTextIcon class={iconStyle} />
				<p class={titleStyle}>{getGreeting()}</p>
				<p class={descStyle}>
					Your notes will show up here. Ready to write something?
				</p>
				<button class={createBtn} onClick={props.onCreateNote}>
					Create Note
				</button>
			</Show>
		</div>
	)
}
