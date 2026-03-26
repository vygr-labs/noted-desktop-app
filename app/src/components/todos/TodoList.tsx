import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { css } from '../../../styled-system/css'
import {
	TriangleAlertIcon,
	SunIcon,
	CalendarClockIcon,
	InboxIcon,
	CircleCheckBigIcon,
} from 'lucide-solid'

const sectionStyle = css({
	mb: '2',
})

const titleRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	mb: '1',
	px: '4',
	py: '2',
})

const titleIcon = css({
	width: '3.5',
	height: '3.5',
	flexShrink: 0,
})

const titleText = css({
	fontSize: '12px',
	fontWeight: '700',
	textTransform: 'uppercase',
	letterSpacing: '0.06em',
	color: 'fg.subtle',
	'&[data-variant="danger"]': { color: 'red.9' },
	'&[data-variant="muted"]': { color: 'fg.muted' },
})

const SECTION_ICONS: Record<string, typeof TriangleAlertIcon> = {
	Overdue: TriangleAlertIcon,
	Today: SunIcon,
	Upcoming: CalendarClockIcon,
	'No Due Date': InboxIcon,
	Completed: CircleCheckBigIcon,
}

export function TodoList(props: {
	title: string
	variant?: 'danger' | 'muted'
	children: JSX.Element
}) {
	const Icon = SECTION_ICONS[props.title]

	return (
		<div class={sectionStyle}>
			<div class={titleRow}>
				<Show when={Icon}>
					{(_icon) => {
						const I = SECTION_ICONS[props.title]
						return (
							<I
								class={titleIcon}
								style={{
									color:
										props.variant === 'danger'
											? 'var(--colors-red-9)'
											: props.variant === 'muted'
												? 'var(--colors-gray-8)'
												: 'var(--colors-fg-subtle)',
								}}
							/>
						)
					}}
				</Show>
				<span class={titleText} data-variant={props.variant}>
					{props.title}
				</span>
			</div>
			{props.children}
		</div>
	)
}
