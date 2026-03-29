import { Show, For, createSignal } from 'solid-js'
import { css } from '../../../styled-system/css'
import { formatCreatedDate, formatRelativeEdited } from '../../lib/date-utils'
import { useEditorStore } from '../../stores/editor-store'
import { PinIcon, EllipsisIcon, LockIcon } from 'lucide-solid'
import { NoteCardMenu, type MenuPosition } from './NoteCardMenu'

const TAG_COLOR_MAP: Record<string, string> = {
	gray: 'var(--colors-gray-9)',
	red: 'var(--colors-red-9)',
	orange: 'var(--colors-orange-9)',
	yellow: 'var(--colors-yellow-9)',
	green: 'var(--colors-green-9)',
	blue: 'var(--colors-blue-9)',
	indigo: 'var(--colors-indigo-9)',
	purple: 'var(--colors-purple-9)',
	pink: 'var(--colors-pink-9)',
	teal: 'var(--colors-teal-9)',
	cyan: 'var(--colors-cyan-9)',
}

const cardStyle = css({
	position: 'relative',
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
	px: '5',
	py: '4',
	cursor: 'pointer',
	transition: 'background 0.12s ease',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a2',
	_hover: {
		bg: 'gray.a2',
		'& .card-actions': {
			opacity: 1,
		},
	},
	'&[data-menu-open="true"]': {
		bg: 'gray.a2',
		'& .card-actions': {
			opacity: 1,
		},
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
	fontSize: '14.5px',
	fontWeight: '600',
	color: 'fg.default',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	flex: 1,
	letterSpacing: '-0.01em',
})

const pinStyle = css({
	width: '3.5',
	height: '3.5',
	color: 'indigo.9',
	flexShrink: 0,
})

const hoverActionBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '6',
	height: '6',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	opacity: 0,
	transition: 'all 0.12s',
	_hover: { bg: 'gray.a4', color: 'fg.default' },
})

const previewText = css({
	fontSize: '13px',
	color: 'fg.muted',
	overflow: 'hidden',
	display: '-webkit-box',
	WebkitLineClamp: 2,
	WebkitBoxOrient: 'vertical',
	lineHeight: '1.6',
})

const metaRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	mt: '0.5',
})

const metaText = css({
	fontSize: '12px',
	color: 'fg.subtle',
	fontWeight: '400',
})

const tagDotsRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
	marginLeft: 'auto',
})

const tagDot = css({
	width: '6px',
	height: '6px',
	borderRadius: 'full',
	flexShrink: 0,
})

const overflowText = css({
	fontSize: '10px',
	color: 'fg.subtle',
	lineHeight: 1,
})

const ellipsisIcon = css({ width: '3.5', height: '3.5' })

export function NoteCard(props: {
	note: Note
	isActive: boolean
	onClick: () => void
	onRefresh: () => void
	isTrash?: boolean
	tags?: Tag[]
}) {
	const editorStore = useEditorStore()
	const [menuPos, setMenuPos] = createSignal<MenuPosition | null>(null)

	const isSyncing = () => props.note.is_shared && !props.note.content && !props.note.content_plain

	const title = () => {
		if (props.isActive) {
			const live = editorStore.liveTitle()
			if (live !== null) return live
		}
		return props.note.title || 'Untitled'
	}

	const preview = () => {
		if (props.note.is_locked) return 'Locked'
		if (props.isActive) {
			const live = editorStore.livePreview()
			if (live !== null) return live
		}
		const plain = props.note.content_plain
		if (plain) return plain.slice(0, 160)
		return ''
	}

	const visibleTags = () => (props.tags || []).slice(0, 5)
	const overflowCount = () => Math.max(0, (props.tags || []).length - 5)

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault()
		setMenuPos({ x: e.clientX, y: e.clientY })
	}

	function handleActionClick(e: MouseEvent) {
		e.stopPropagation()
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
		setMenuPos({ x: rect.left, y: rect.bottom + 4 })
	}

	return (
		<>
			<div
				class={cardStyle}
				data-active={props.isActive}
				data-menu-open={!!menuPos()}
				onClick={props.onClick}
				onContextMenu={handleContextMenu}
			>
				<div class={`card-indicator ${indicator}`} />
				<div class={titleRow}>
					<Show when={!isSyncing()} fallback={
						<span class={css({ height: '14px', width: '60%', borderRadius: 'sm', bg: 'gray.a4', animation: 'pulse 1.5s ease-in-out infinite' })} />
					}>
						<span class={titleText}>{title()}</span>
					</Show>
					<Show when={props.note.is_locked}>
						<LockIcon class={pinStyle} style={{ color: 'var(--colors-orange-9)' }} />
					</Show>
					<Show when={props.note.is_pinned}>
						<PinIcon class={pinStyle} />
					</Show>
					<button
						class={`card-actions ${hoverActionBtn}`}
						onClick={handleActionClick}
						title="More actions"
					>
						<EllipsisIcon class={ellipsisIcon} />
					</button>
				</div>
				<Show when={isSyncing()}>
					<div class={css({ display: 'flex', flexDirection: 'column', gap: '1.5', mt: '1', animation: 'pulse 1.5s ease-in-out infinite' })}>
						<div class={css({ height: '10px', width: '90%', borderRadius: 'xs', bg: 'gray.a3' })} />
						<div class={css({ height: '10px', width: '65%', borderRadius: 'xs', bg: 'gray.a3' })} />
					</div>
				</Show>
				<Show when={!isSyncing() && preview()}>
					<div class={previewText}>{preview()}</div>
				</Show>
				<div class={metaRow}>
					<span class={metaText}>
						{formatCreatedDate(props.note.created_at)}
						{' · '}
						{formatRelativeEdited(props.note.updated_at)}
					</span>
					<Show when={visibleTags().length > 0}>
						<div class={tagDotsRow}>
							<For each={visibleTags()}>
								{(tag) => (
									<div
										class={tagDot}
										style={{
											background:
												TAG_COLOR_MAP[tag.color] ||
												TAG_COLOR_MAP.gray,
										}}
										title={tag.name}
									/>
								)}
							</For>
							<Show when={overflowCount() > 0}>
								<span class={overflowText}>
									+{overflowCount()}
								</span>
							</Show>
						</div>
					</Show>
				</div>
			</div>
			<Show when={menuPos()}>
				<NoteCardMenu
					note={props.note}
					position={menuPos()!}
					isTrash={!!props.isTrash}
					onClose={() => setMenuPos(null)}
					onRefresh={props.onRefresh}
				/>
			</Show>
		</>
	)
}
