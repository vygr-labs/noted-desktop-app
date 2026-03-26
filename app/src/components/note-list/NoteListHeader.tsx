import { Show, createSignal, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { PlusIcon, ArrowUpDownIcon, PanelLeftCloseIcon } from 'lucide-solid'
import { useAppStore } from '../../stores/app-store'

const headerStyle = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: '2',
	px: '5',
	py: '4',
	flexShrink: 0,
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a2',
})

const titleStyle = css({
	fontSize: '16px',
	fontWeight: '700',
	color: 'fg.default',
	letterSpacing: '-0.02em',
})

const actions = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
})

const actionBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '8',
	height: '8',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const iconSize = css({ width: '4', height: '4' })

const dropdown = css({
	position: 'absolute',
	top: '100%',
	right: 0,
	mt: '1',
	py: '1',
	minWidth: '160px',
	borderRadius: 'md',
	bg: 'gray.2',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25)',
	zIndex: 100,
	animation: 'fade-in 0.1s ease',
})

const dropdownItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '3',
	py: '2',
	fontSize: '12.5px',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	'&[data-active="true"]': {
		color: 'indigo.11',
	},
})

const checkMark = css({
	width: '14px',
	fontSize: '12px',
	flexShrink: 0,
})

export function NoteListHeader(props: {
	title: string
	onCreateNote: () => void
	showCreate: boolean
}) {
	const store = useAppStore()
	const [showSort, setShowSort] = createSignal(false)
	let sortContainerRef: HTMLDivElement | undefined

	const sortOptions: { value: NoteSortOrder; label: string }[] = [
		{ value: 'created_at', label: 'Date created' },
		{ value: 'updated_at', label: 'Date modified' },
		{ value: 'title', label: 'Title' },
	]

	function handleSort(sort: NoteSortOrder) {
		store.setNoteSort(sort)
		setShowSort(false)
	}

	// Close dropdown when clicking outside the sort container
	onMount(() => {
		function handleClickOutside(e: MouseEvent) {
			if (showSort() && sortContainerRef && !sortContainerRef.contains(e.target as Node)) {
				setShowSort(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		onCleanup(() => document.removeEventListener('mousedown', handleClickOutside))
	})

	return (
		<div class={headerStyle}>
			<div class={titleStyle}>{props.title}</div>
			<div class={actions}>
				<div ref={sortContainerRef} style={{ position: 'relative' }}>
					<button
						class={actionBtn}
						onClick={() => setShowSort(!showSort())}
						title="Sort notes"
					>
						<ArrowUpDownIcon class={iconSize} />
					</button>
					<Show when={showSort()}>
						<div class={dropdown}>
							{sortOptions.map((opt) => (
								<div
									class={dropdownItem}
									data-active={store.noteSort() === opt.value}
									onClick={() => handleSort(opt.value)}
								>
									<span class={checkMark}>
										{store.noteSort() === opt.value ? '✓' : ''}
									</span>
									{opt.label}
								</div>
							))}
						</div>
					</Show>
				</div>
				<Show when={props.showCreate}>
					<button class={actionBtn} onClick={props.onCreateNote} title="New note">
						<PlusIcon class={iconSize} />
					</button>
				</Show>
				<button
					class={actionBtn}
					onClick={() => store.setNoteListCollapsed(true)}
					title="Collapse panel (Ctrl+[)"
				>
					<PanelLeftCloseIcon class={iconSize} />
				</button>
			</div>
		</div>
	)
}
