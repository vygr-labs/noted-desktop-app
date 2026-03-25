import { Show, createSignal, createEffect, on, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useEditorStore } from '../../stores/editor-store'
import { useAppStore } from '../../stores/app-store'
import { NoteHeader } from '../editor/NoteHeader'
import { TipTapEditor, getEditorInstance, searchInNote, clearNoteSearch, scrollToSearchMatch, replaceCurrentMatch, replaceAllMatches } from '../editor/TipTapEditor'
import { PlainTextEditor } from '../editor/PlainTextEditor'
import { TagsBar } from '../editor/TagsBar'
import { EditorToolbar, type ToolbarPosition } from '../editor/EditorToolbar'
import {
	MaximizeIcon,
	MinimizeIcon,
	PenLineIcon,
	PanelTopIcon,
	PanelRightIcon,
	PanelBottomIcon,
	PanelLeftIcon,
	PanelLeftOpenIcon,
	SearchIcon,
	XIcon,
	ChevronUpIcon,
	ChevronDownIcon,
	ReplaceIcon,
} from 'lucide-solid'

const editorContainer = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'hidden',
	bg: 'bg.default',
})

const editorBody = css({
	display: 'flex',
	flex: 1,
	overflow: 'hidden',
})

const editorContent = css({
	flex: 1,
	overflow: 'auto',
})

const contentInner = css({
	width: '100%',
	px: '10',
	py: '6',
})

const emptyContainer = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	height: '100%',
	gap: '3',
	animation: 'fade-in 0.4s ease-out',
})

const emptyIconWrap = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '16',
	height: '16',
	borderRadius: 'xl',
	bg: 'gray.a2',
	mb: '2',
})

const emptyIcon = css({
	width: '7',
	height: '7',
	color: 'gray.a6',
	strokeWidth: '1.5',
})

const emptyTitle = css({
	fontSize: '16px',
	fontWeight: '600',
	color: 'fg.default',
	letterSpacing: '-0.02em',
})

const emptyDesc = css({
	fontSize: '14px',
	color: 'fg.muted',
	textAlign: 'center',
	maxWidth: '260px',
	lineHeight: '1.6',
})

const emptyKbd = css({
	display: 'inline-flex',
	alignItems: 'center',
	gap: '1',
	fontSize: '12px',
	color: 'fg.subtle',
	bg: 'gray.a2',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	borderRadius: 'md',
	px: '2.5',
	py: '1',
	fontFamily: 'mono',
	mt: '3',
	letterSpacing: '0.02em',
})

const controlsRow = css({
	position: 'absolute',
	top: '3',
	right: '3',
	display: 'flex',
	alignItems: 'center',
	gap: '0.5',
	zIndex: 5,
})

const controlBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '8',
	height: '8',
	borderRadius: 'lg',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.2s',
	opacity: 0.6,
	_hover: { bg: 'gray.a3', color: 'fg.default', opacity: 1 },
})

const controlIconSize = css({ width: '4', height: '4' })

const expandListBtn = css({
	position: 'absolute',
	top: '3',
	left: '3',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '8',
	height: '8',
	borderRadius: 'lg',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.2s',
	opacity: 0.6,
	zIndex: 5,
	_hover: { bg: 'gray.a3', color: 'fg.default', opacity: 1 },
})

// ─── Note search bar ──────────────────────────────────────

const searchBar = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '4',
	py: '2',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a3',
	bg: 'gray.a2',
	flexShrink: 0,
	animation: 'fade-in 0.1s ease',
})

const searchInput = css({
	flex: 1,
	bg: 'transparent',
	border: 'none',
	outline: 'none',
	color: 'fg.default',
	fontSize: '13px',
	'&::placeholder': { color: 'fg.subtle' },
})

const searchCount = css({
	fontSize: '11px',
	color: 'fg.subtle',
	flexShrink: 0,
	whiteSpace: 'nowrap',
})

const searchBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '6',
	height: '6',
	borderRadius: 'sm',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const searchBtnIcon = css({ width: '3.5', height: '3.5' })

const replaceRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '4',
	py: '2',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a3',
	bg: 'gray.a2',
	flexShrink: 0,
	animation: 'fade-in 0.1s ease',
})

const replaceTextBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	height: '6',
	padding: '0 8px',
	borderRadius: 'sm',
	cursor: 'pointer',
	color: 'fg.subtle',
	flexShrink: 0,
	fontSize: '11px',
	fontWeight: 'medium',
	fontFamily: 'inherit',
	transition: 'all 0.1s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const POSITIONS: ToolbarPosition[] = ['top', 'right', 'bottom', 'left']

function ToolbarPositionIcon(props: { position: ToolbarPosition }) {
	return (
		<>
			<Show when={props.position === 'top'}>
				<PanelTopIcon class={controlIconSize} />
			</Show>
			<Show when={props.position === 'right'}>
				<PanelRightIcon class={controlIconSize} />
			</Show>
			<Show when={props.position === 'bottom'}>
				<PanelBottomIcon class={controlIconSize} />
			</Show>
			<Show when={props.position === 'left'}>
				<PanelLeftIcon class={controlIconSize} />
			</Show>
		</>
	)
}

export function EditorPane() {
	const editorStore = useEditorStore()
	const appStore = useAppStore()

	const [isScrolled, setIsScrolled] = createSignal(false)
	const [searchQuery, setSearchQuery] = createSignal('')
	const [replaceQuery, setReplaceQuery] = createSignal('')
	const [showReplace, setShowReplace] = createSignal(false)
	const [searchMatches, setSearchMatches] = createSignal(0)
	const [currentMatch, setCurrentMatch] = createSignal(0)
	let searchInputRef: HTMLInputElement | undefined

	function performSearch(query: string) {
		if (!query.trim()) {
			clearNoteSearch()
			setSearchMatches(0)
			setCurrentMatch(0)
			return
		}

		const editor = getEditorInstance()
		if (editor) {
			const count = searchInNote(query, 0)
			setSearchMatches(count)
			setCurrentMatch(count > 0 ? 1 : 0)
			if (count > 0) scrollToSearchMatch(0)
		} else {
			// Plain text fallback
			const note = editorStore.currentNote()
			const text = (note?.content_plain || note?.content || '').toLowerCase()
			const q = query.toLowerCase()
			let count = 0, idx = text.indexOf(q)
			while (idx !== -1) { count++; idx = text.indexOf(q, idx + 1) }
			setSearchMatches(count)
			setCurrentMatch(count > 0 ? 1 : 0)
		}
	}

	function navigateMatch(dir: 1 | -1) {
		const total = searchMatches()
		if (total === 0) return
		let next = currentMatch() + dir
		if (next > total) next = 1
		if (next < 1) next = total
		setCurrentMatch(next)

		const editor = getEditorInstance()
		if (editor) {
			searchInNote(searchQuery(), next - 1)
			scrollToSearchMatch(next - 1)
		}
	}

	function handleReplace() {
		const query = searchQuery()
		if (!query || searchMatches() === 0) return
		const idx = currentMatch() - 1
		const count = replaceCurrentMatch(query, replaceQuery(), idx)
		setSearchMatches(count)
		setCurrentMatch(count > 0 ? Math.min(currentMatch(), count) : 0)
		if (count > 0) scrollToSearchMatch(currentMatch() - 1)
	}

	function handleReplaceAll() {
		const query = searchQuery()
		if (!query || searchMatches() === 0) return
		const count = replaceAllMatches(query, replaceQuery())
		setSearchMatches(count)
		setCurrentMatch(0)
	}

	function closeSearch() {
		appStore.setNoteSearchOpen(false)
		setSearchQuery('')
		setReplaceQuery('')
		setShowReplace(false)
		setSearchMatches(0)
		setCurrentMatch(0)
		clearNoteSearch()
	}

	createEffect(
		on(
			() => appStore.noteSearchOpen(),
			(open) => {
				if (open) {
					requestAnimationFrame(() => searchInputRef?.focus())
				} else {
					setSearchQuery('')
					setReplaceQuery('')
					setShowReplace(false)
					setSearchMatches(0)
					setCurrentMatch(0)
					clearNoteSearch()
				}
			}
		)
	)

	// Ctrl+H: open search with replace
	onMount(() => {
		function handleReplaceShortcut(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
				e.preventDefault()
				if (!appStore.noteSearchOpen()) {
					appStore.setNoteSearchOpen(true)
				}
				setShowReplace(true)
				requestAnimationFrame(() => searchInputRef?.focus())
			}
		}
		window.addEventListener('keydown', handleReplaceShortcut)
		onCleanup(() => window.removeEventListener('keydown', handleReplaceShortcut))
	})

	const [toolbarPosition, setToolbarPosition] =
		createSignal<ToolbarPosition>('top')

	function cycleToolbarPosition() {
		const current = toolbarPosition()
		const idx = POSITIONS.indexOf(current)
		setToolbarPosition(POSITIONS[(idx + 1) % POSITIONS.length])
	}

	function handleScroll(e: Event) {
		const target = e.target as HTMLElement
		setIsScrolled(target.scrollTop > 0)
	}

	const isTrash = () => appStore.currentView() === 'trash'
	const isHorizontal = () =>
		toolbarPosition() === 'top' || toolbarPosition() === 'bottom'
	const showToolbar = (note: Note) =>
		note.note_type === 'rich' && !isTrash()

	const nextPositionLabel = () => {
		const current = toolbarPosition()
		const idx = POSITIONS.indexOf(current)
		return POSITIONS[(idx + 1) % POSITIONS.length]
	}

	return (
		<div class={editorContainer} style={{ position: 'relative' }}>
			<Show
				when={editorStore.currentNote()}
				fallback={
					<>
						<Show when={appStore.noteListCollapsed() && !appStore.focusMode()}>
							<button
								class={expandListBtn}
								onClick={() => appStore.setNoteListCollapsed(false)}
								title="Expand note list (Ctrl+[)"
							>
								<PanelLeftOpenIcon class={controlIconSize} />
							</button>
						</Show>
						<div class={emptyContainer}>
							<div class={emptyIconWrap}>
								<PenLineIcon class={emptyIcon} />
							</div>
							<p class={emptyTitle}>No note selected</p>
							<p class={emptyDesc}>
								Pick a note from the sidebar, or create a new one to
								start writing.
							</p>
							<span class={emptyKbd}>Ctrl+Shift+F to search</span>
						</div>
					</>
				}
			>
				{(note) => (
					<>
						{/* Top toolbar */}
						<Show
							when={
								showToolbar(note()) &&
								toolbarPosition() === 'top'
							}
						>
							<EditorToolbar
								scrolled={isScrolled()}
								position="top"
							/>
						</Show>

						{/* In-note search bar */}
						<Show when={appStore.noteSearchOpen()}>
							<div class={searchBar}>
								<button
									class={searchBtn}
									onClick={() => setShowReplace(!showReplace())}
									title={showReplace() ? 'Hide replace (Ctrl+H)' : 'Show replace (Ctrl+H)'}
								>
									<ReplaceIcon class={searchBtnIcon} />
								</button>
								<input
									ref={searchInputRef}
									class={searchInput}
									value={searchQuery()}
									onInput={(e) => {
										setSearchQuery(e.currentTarget.value)
										performSearch(e.currentTarget.value)
									}}
									onKeyDown={(e) => {
										if (e.key === 'Escape') closeSearch()
										if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); navigateMatch(1) }
										if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); navigateMatch(-1) }
									}}
									placeholder="Find in note..."
								/>
								<Show when={searchQuery().length > 0}>
									<span class={searchCount}>
										{searchMatches() > 0 ? `${currentMatch()} of ${searchMatches()}` : 'No results'}
									</span>
								</Show>
								<button class={searchBtn} onClick={() => navigateMatch(-1)} title="Previous (Shift+Enter)">
									<ChevronUpIcon class={searchBtnIcon} />
								</button>
								<button class={searchBtn} onClick={() => navigateMatch(1)} title="Next (Enter)">
									<ChevronDownIcon class={searchBtnIcon} />
								</button>
								<button class={searchBtn} onClick={closeSearch} title="Close (Esc)">
									<XIcon class={searchBtnIcon} />
								</button>
							</div>
							<Show when={showReplace()}>
								<div class={replaceRow}>
									<ReplaceIcon class={searchBtnIcon} style={{ 'flex-shrink': '0', color: 'var(--colors-fg-subtle)', visibility: 'hidden' }} />
									<input
										class={searchInput}
										value={replaceQuery()}
										onInput={(e) => setReplaceQuery(e.currentTarget.value)}
										onKeyDown={(e) => {
											if (e.key === 'Escape') closeSearch()
											if (e.key === 'Enter') { e.preventDefault(); handleReplace() }
										}}
										placeholder="Replace with..."
									/>
									<button class={replaceTextBtn} onClick={handleReplace} title="Replace current match">
										Replace
									</button>
									<button class={replaceTextBtn} onClick={handleReplaceAll} title="Replace all matches">
										All
									</button>
								</div>
							</Show>
						</Show>

						{/* Body: left toolbar | content | right toolbar */}
						<div class={editorBody}>
							<Show
								when={
									showToolbar(note()) &&
									toolbarPosition() === 'left'
								}
							>
								<EditorToolbar position="left" />
							</Show>

							<div
								class={editorContent}
								onScroll={handleScroll}
							>
								<div class={contentInner}>
									<NoteHeader
										note={note()}
										readonly={isTrash()}
									/>
									<TagsBar
										noteId={note().id}
										readonly={isTrash()}
									/>
									<Show
										when={note().note_type === 'rich'}
										fallback={
											<PlainTextEditor
												note={note()}
												readonly={isTrash()}
											/>
										}
									>
										<TipTapEditor
											note={note()}
											readonly={isTrash()}
										/>
									</Show>
								</div>
							</div>

							<Show
								when={
									showToolbar(note()) &&
									toolbarPosition() === 'right'
								}
							>
								<EditorToolbar position="right" />
							</Show>
						</div>

						{/* Bottom toolbar */}
						<Show
							when={
								showToolbar(note()) &&
								toolbarPosition() === 'bottom'
							}
						>
							<EditorToolbar position="bottom" />
						</Show>

						{/* Controls: expand list + toolbar position + focus mode */}
						<div class={controlsRow}>
							<Show when={appStore.noteListCollapsed() && !appStore.focusMode()}>
								<button
									class={controlBtn}
									onClick={() => appStore.setNoteListCollapsed(false)}
									title="Expand note list (Ctrl+[)"
								>
									<PanelLeftOpenIcon class={controlIconSize} />
								</button>
							</Show>
							<Show when={showToolbar(note())}>
								<button
									class={controlBtn}
									onClick={cycleToolbarPosition}
									title={`Move toolbar to ${nextPositionLabel()}`}
								>
									<ToolbarPositionIcon
										position={toolbarPosition()}
									/>
								</button>
							</Show>
							<button
								class={controlBtn}
								onClick={() =>
									appStore.setFocusMode(
										!appStore.focusMode()
									)
								}
								title={
									appStore.focusMode()
										? 'Exit focus mode'
										: 'Focus mode'
								}
							>
								<Show
									when={appStore.focusMode()}
									fallback={
										<MaximizeIcon
											class={controlIconSize}
										/>
									}
								>
									<MinimizeIcon class={controlIconSize} />
								</Show>
							</button>
						</div>
					</>
				)}
			</Show>
		</div>
	)
}
