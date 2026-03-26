import { Show, For, createSignal, createEffect, on, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useEditorStore } from '../../stores/editor-store'
import { useAppStore } from '../../stores/app-store'
import { useSyncStore } from '../../stores/sync-store'
import QRCode from 'qrcode'
import { NoteHeader } from '../editor/NoteHeader'
import { TipTapEditor, getEditorInstance, searchInNote, clearNoteSearch, scrollToSearchMatch, replaceCurrentMatch, replaceAllMatches } from '../editor/TipTapEditor'
import { PlainTextEditor } from '../editor/PlainTextEditor'
import { TagsBar } from '../editor/TagsBar'
import { EditorToolbar, type ToolbarPosition } from '../editor/EditorToolbar'
import { LockOverlay } from '../editor/LockOverlay'
import { PinDialog } from '../editor/PinDialog'
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
	DownloadIcon,
	Share2Icon,
	LinkIcon,
	CopyIcon,
	UsersIcon,
	LockIcon,
	UnlockIcon,
	TypeIcon,
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
	display: 'flex',
	alignItems: 'center',
	gap: '0.5',
	flexShrink: 0,
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

const exportMenu = css({
	position: 'absolute',
	top: '100%',
	right: 0,
	mt: '1',
	minWidth: '160px',
	py: '1',
	bg: 'gray.1',
	borderRadius: 'lg',
	border: '1px solid',
	borderColor: 'gray.a3',
	boxShadow: '0 8px 24px -4px rgba(0,0,0,0.15)',
	zIndex: 20,
	animation: 'fade-in 0.1s ease',
})

const exportMenuItem = css({
	display: 'flex',
	alignItems: 'center',
	width: '100%',
	px: '3',
	py: '1.5',
	fontSize: '13px',
	color: 'fg.muted',
	cursor: 'pointer',
	transition: 'all 0.1s',
	whiteSpace: 'nowrap',
	textAlign: 'left',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

const syncSkeleton = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '3',
	mt: '4',
	animation: 'pulse 1.5s ease-in-out infinite',
})

const skeletonLine = css({
	height: '14px',
	borderRadius: 'sm',
	bg: 'gray.a3',
})

const NOTE_EXPORT_FORMATS = [
	{ key: 'pdf', label: 'PDF Document' },
	{ key: 'doc', label: 'Word Document' },
	{ key: 'html', label: 'HTML File' },
	{ key: 'md', label: 'Markdown' },
	{ key: 'txt', label: 'Plain Text' },
]

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
	const [showExportMenu, setShowExportMenu] = createSignal(false)
	const [showShareMenu, setShowShareMenu] = createSignal(false)
	const [shareCode, setShareCode] = createSignal('')
	const [joinCode, setJoinCode] = createSignal('')
	const [showJoinDialog, setShowJoinDialog] = createSignal(false)

	const syncStore = useSyncStore()
	const [qrDataUrl, setQrDataUrl] = createSignal('')

	// Session-based unlock tracking (unlocked note IDs persist until app restart)
	const [unlockedIds, setUnlockedIds] = createSignal<Set<string>>(new Set())
	const isNoteLocked = (note: Note) =>
		note.is_locked && !unlockedIds().has(note.id)

	function unlockNote(noteId: string) {
		setUnlockedIds((prev) => new Set([...prev, noteId]))
	}

	const [pinDialog, setPinDialog] = createSignal<{
		title: string; description: string; confirmLabel: string;
		onConfirm: (pin: string) => void | Promise<void>
	} | null>(null)

	async function convertToRich(noteId: string) {
		await window.electronAPI.updateNote(noteId, { note_type: 'rich' })
		await editorStore.refreshCurrentNote()
	}

	async function toggleLock(noteId: string) {
		const hasPin = await window.electronAPI.hasLockPin()
		if (!hasPin) {
			// Need to set a PIN first
			setPinDialog({
				title: 'Set a lock PIN',
				description: 'This PIN will be used to lock and unlock notes.',
				confirmLabel: 'Set PIN',
				onConfirm: async (pin) => {
					await window.electronAPI.setLockPin(pin)
					setPinDialog(null)
					const isNowLocked = await window.electronAPI.toggleNoteLock(noteId)
					if (!isNowLocked) unlockNote(noteId)
					await editorStore.refreshCurrentNote()
				},
			})
			return
		}
		const isNowLocked = await window.electronAPI.toggleNoteLock(noteId)
		if (!isNowLocked) unlockNote(noteId)
		await editorStore.refreshCurrentNote()
	}
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

	async function generateQrCode(code: string) {
		try {
			const url = `noted://join/${code}`
			const dataUrl = await QRCode.toDataURL(url, {
				width: 160,
				margin: 1,
				color: { dark: '#1a1a2e', light: '#ffffff' },
			})
			setQrDataUrl(dataUrl)
		} catch {
			setQrDataUrl('')
		}
	}

	async function handleShare(noteId: string) {
		const syncId = await window.electronAPI.shareNote(noteId)
		if (syncId) {
			setShareCode(syncId)
			navigator.clipboard.writeText(syncId)
			generateQrCode(syncId)
			await editorStore.refreshCurrentNote()
			setShowShareMenu(true)
		}
	}

	async function handleUnshare(noteId: string) {
		const note = editorStore.currentNote()
		// Signal unshare to remote peers before cleaning up locally
		if (note?.sync_id) {
			syncStore.signalUnshare(note.sync_id)
		}
		await window.electronAPI.unshareNote(noteId)
		setShareCode('')
		setShowShareMenu(false)
		await editorStore.refreshCurrentNote()
	}

	async function handleJoin() {
		const code = joinCode().trim()
		if (!code) return
		const noteId = await window.electronAPI.joinSharedNote(code)
		if (noteId) {
			appStore.refetchNotes()
			appStore.setSelectedNoteId(noteId)
			setJoinCode('')
			setShowJoinDialog(false)
		}
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
		function handleClickOutside(e: MouseEvent) {
			const target = e.target as HTMLElement
			if (showExportMenu() && !target.closest('[data-export-menu]')) {
				setShowExportMenu(false)
			}
			if (showShareMenu() && !target.closest('[data-share-menu]')) {
				setShowShareMenu(false)
			}
		}
		window.addEventListener('keydown', handleReplaceShortcut)
		window.addEventListener('mousedown', handleClickOutside)
		onCleanup(() => {
			window.removeEventListener('keydown', handleReplaceShortcut)
			window.removeEventListener('mousedown', handleClickOutside)
		})
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
		<div class={editorContainer}>
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
						{/* Top bar: toolbar (if top position) + controls */}
						<div
							style={{
								display: 'flex',
								'align-items': 'flex-start',
								'flex-shrink': '0',
								'border-bottom': (showToolbar(note()) && toolbarPosition() === 'top') ? '1px solid var(--colors-gray-a2)' : 'none',
								'box-shadow': (showToolbar(note()) && toolbarPosition() === 'top' && isScrolled()) ? '0 2px 12px -3px rgba(0,0,0,0.1)' : 'none',
								'z-index': '2',
								transition: 'box-shadow 0.2s ease',
							}}
						>
							<Show
								when={
									showToolbar(note()) &&
									toolbarPosition() === 'top'
								}
							>
								<div style={{ flex: '1', 'min-width': '0' }}>
									<EditorToolbar
										scrolled={false}
										position="top"
									/>
								</div>
							</Show>
							<div class={controlsRow} style={{ 'margin-left': 'auto', padding: '8px 12px' }}>
							<Show when={appStore.noteListCollapsed() && !appStore.focusMode()}>
								<button
									class={controlBtn}
									onClick={() => appStore.setNoteListCollapsed(false)}
									title="Expand note list (Ctrl+[)"
								>
									<PanelLeftOpenIcon class={controlIconSize} />
								</button>
							</Show>
							<button
								class={controlBtn}
								onClick={() => toggleLock(note().id)}
								title={note().is_locked ? 'Unlock note' : 'Lock note'}
								style={note().is_locked ? { color: 'var(--colors-orange-11)', opacity: '1' } : {}}
							>
								<Show when={note().is_locked} fallback={<UnlockIcon class={controlIconSize} />}>
									<LockIcon class={controlIconSize} />
								</Show>
							</button>
							<div style={{ position: 'relative' }} data-export-menu>
								<button
									class={controlBtn}
									onClick={() => setShowExportMenu(!showExportMenu())}
									title="Export note"
								>
									<DownloadIcon class={controlIconSize} />
								</button>
								<Show when={showExportMenu()}>
									<div class={exportMenu}>
										<For each={NOTE_EXPORT_FORMATS}>
											{(fmt) => (
												<button
													class={exportMenuItem}
													onClick={() => {
														setShowExportMenu(false)
														window.electronAPI.exportNote(note().id, fmt.key)
													}}
												>
													{fmt.label}
												</button>
											)}
										</For>
									</div>
								</Show>
							</div>
							<Show when={note().note_type === 'rich' && !isTrash()}>
								<div style={{ position: 'relative' }} data-share-menu>
									<button
										class={controlBtn}
										onClick={() => {
											const existingCode = shareCode()
											if ((note().is_shared && note().sync_id) || existingCode) {
												if (!existingCode && note().sync_id && note().sync_secret) {
													const code = `${note().sync_id}.${note().sync_secret}`
													setShareCode(code)
													generateQrCode(code)
												} else if (existingCode) {
													generateQrCode(existingCode)
												}
											}
											setShowShareMenu(!showShareMenu())
										}}
										title={(shareCode() || note().is_shared) ? 'Sharing active' : 'Share note'}
										style={(shareCode() || note().is_shared) ? { color: 'var(--colors-indigo-11)', opacity: '1' } : {}}
									>
										<Share2Icon class={controlIconSize} />
									</button>
									<Show when={showShareMenu()}>
										<div class={exportMenu}>
											<Show
												when={shareCode() || note().is_shared}
												fallback={
													<>
														<button
															class={exportMenuItem}
															onClick={() => {
																setShowShareMenu(false)
																handleShare(note().id)
															}}
														>
															<LinkIcon class={css({ width: '3.5', height: '3.5', mr: '2' })} />
															Share &amp; copy code
														</button>
														<button
															class={exportMenuItem}
															onClick={() => {
																setShowShareMenu(false)
																setShowJoinDialog(true)
															}}
														>
															<UsersIcon class={css({ width: '3.5', height: '3.5', mr: '2' })} />
															Join shared note
														</button>
													</>
												}
											>
												<div style={{ padding: '8px 12px', 'font-size': '11px', color: 'var(--colors-fg-subtle)' }}>
													Share code:
												</div>
												<div style={{ padding: '0 12px 8px', display: 'flex', gap: '4px' }}>
													<input
														class={css({
															flex: 1, bg: 'gray.a2', border: '1px solid', borderColor: 'gray.a4',
															borderRadius: 'sm', px: '2', py: '1', fontSize: '11px', color: 'fg.default',
															fontFamily: 'mono', outline: 'none',
														})}
														value={shareCode()}
														readOnly
													/>
													<button
														class={exportMenuItem}
														style={{ padding: '4px 8px', width: 'auto' }}
														onClick={() => navigator.clipboard.writeText(shareCode())}
														title="Copy"
													>
														<CopyIcon class={css({ width: '3', height: '3' })} />
													</button>
												</div>
												<Show when={qrDataUrl()}>
													<div style={{ padding: '4px 12px 8px', display: 'flex', 'justify-content': 'center' }}>
														<img src={qrDataUrl()} alt="QR Code" style={{ width: '120px', height: '120px', 'border-radius': '8px' }} />
													</div>
												</Show>
												{(() => {
													const syncId = note().sync_id
													if (!syncId) return null
													// Read peersVersion to trigger reactivity
													syncStore.peersVersion()
													const peers = syncStore.getPeers(syncId)
													if (peers.length === 0) return null
													return (
														<div style={{ padding: '4px 12px 8px', 'font-size': '11px', color: 'var(--colors-fg-muted)' }}>
															<div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'flex-wrap': 'wrap' }}>
																<UsersIcon class={css({ width: '3', height: '3' })} />
																<span>{peers.length} collaborator{peers.length > 1 ? 's' : ''} online</span>
															</div>
															<div style={{ display: 'flex', gap: '3px', 'margin-top': '4px' }}>
																{peers.map(p => (
																	<div
																		title={p.name}
																		style={{
																			width: '20px', height: '20px', 'border-radius': '50%',
																			background: p.color, display: 'flex', 'align-items': 'center',
																			'justify-content': 'center', 'font-size': '10px', color: 'white',
																			'font-weight': '600',
																		}}
																	>
																		{p.name.charAt(0).toUpperCase()}
																	</div>
																))}
															</div>
														</div>
													)
												})()}
												<button
													class={exportMenuItem}
													style={{ color: 'var(--colors-red-11)' }}
													onClick={() => handleUnshare(note().id)}
												>
													Stop sharing
												</button>
											</Show>
										</div>
									</Show>
								</div>
							</Show>
							<Show when={note().note_type === 'plain' && !isTrash()}>
								<button
									class={controlBtn}
									onClick={() => convertToRich(note().id)}
									title="Convert to rich text"
								>
									<TypeIcon class={controlIconSize} />
								</button>
							</Show>
							<Show when={showToolbar(note())}>
								<button
									class={controlBtn}
									onClick={cycleToolbarPosition}
									title={`Move toolbar to ${nextPositionLabel()}`}
								>
									<ToolbarPositionIcon position={toolbarPosition()} />
								</button>
							</Show>
							<button
								class={controlBtn}
								onClick={() => appStore.setFocusMode(!appStore.focusMode())}
								title={appStore.focusMode() ? 'Exit focus mode' : 'Focus mode'}
							>
								<Show when={appStore.focusMode()} fallback={<MaximizeIcon class={controlIconSize} />}>
									<MinimizeIcon class={controlIconSize} />
								</Show>
							</button>
						</div>
						</div>

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
								style={{ position: 'relative' }}
							>
								<Show when={isNoteLocked(note())}>
									<LockOverlay onUnlock={() => unlockNote(note().id)} />
								</Show>
								<div
									class={contentInner}
									style={isNoteLocked(note()) ? { filter: 'blur(8px)', 'pointer-events': 'none', 'user-select': 'none' } : {}}
								>
									<NoteHeader
										note={note()}
										readonly={isTrash()}
									/>
									<TagsBar
										noteId={note().id}
										readonly={isTrash()}
									/>
									<Show
										when={!(note().is_shared && !note().content && !note().content_plain)}
										fallback={
											<div class={syncSkeleton}>
												<div class={skeletonLine} style={{ width: '90%' }} />
												<div class={skeletonLine} style={{ width: '75%' }} />
												<div class={skeletonLine} style={{ width: '85%' }} />
												<div class={skeletonLine} style={{ width: '40%' }} />
												<div style={{ height: '8px' }} />
												<div class={skeletonLine} style={{ width: '95%' }} />
												<div class={skeletonLine} style={{ width: '70%' }} />
												<div class={skeletonLine} style={{ width: '80%' }} />
												<div style={{
													'font-size': '12px', color: 'var(--colors-fg-subtle)',
													'text-align': 'center', 'margin-top': '16px',
												}}>
													Syncing content...
												</div>
											</div>
										}
									>
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

					</>
				)}
			</Show>
			{/* PIN dialog */}
			<Show when={pinDialog()}>
				{(dlg) => (
					<PinDialog
						title={dlg().title}
						description={dlg().description}
						confirmLabel={dlg().confirmLabel}
						onConfirm={dlg().onConfirm}
						onCancel={() => setPinDialog(null)}
					/>
				)}
			</Show>
			{/* Join shared note dialog */}
			<Show when={showJoinDialog()}>
				<div
					style={{
						position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)',
						display: 'flex', 'align-items': 'center', 'justify-content': 'center',
						'z-index': '50',
					}}
					onClick={() => setShowJoinDialog(false)}
				>
					<div
						style={{
							background: 'var(--colors-gray-2)', 'border-radius': '12px',
							padding: '24px', width: '380px',
							'box-shadow': '0 24px 64px -8px rgba(0,0,0,0.4)',
							border: '1px solid var(--colors-gray-a3)',
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div style={{ 'font-size': '16px', 'font-weight': '600', 'margin-bottom': '4px', color: 'var(--colors-fg-default)' }}>
							Join shared note
						</div>
						<div style={{ 'font-size': '13px', color: 'var(--colors-fg-muted)', 'margin-bottom': '16px' }}>
							Enter the share code to start collaborating
						</div>
						<input
							class={css({
								width: '100%', bg: 'gray.a2', border: '1px solid', borderColor: 'gray.a4',
								borderRadius: 'md', px: '3', py: '2.5', fontSize: '14px', color: 'fg.default',
								fontFamily: 'mono', outline: 'none', mb: '4',
								_focus: { borderColor: 'indigo.8' },
								'&::placeholder': { color: 'fg.subtle' },
							})}
							value={joinCode()}
							onInput={(e) => setJoinCode(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleJoin()
								if (e.key === 'Escape') setShowJoinDialog(false)
							}}
							placeholder="Paste share code..."
							ref={(el) => requestAnimationFrame(() => el.focus())}
						/>
						<div style={{ display: 'flex', gap: '8px', 'justify-content': 'flex-end' }}>
							<button
								class={css({
									px: '4', py: '2', borderRadius: 'md', fontSize: '13px',
									cursor: 'pointer', color: 'fg.muted',
									_hover: { bg: 'gray.a3' },
								})}
								onClick={() => setShowJoinDialog(false)}
							>
								Cancel
							</button>
							<button
								class={css({
									px: '4', py: '2', borderRadius: 'md', fontSize: '13px', fontWeight: '500',
									cursor: 'pointer', bg: 'indigo.9', color: 'white',
									_hover: { bg: 'indigo.10' },
								})}
								onClick={handleJoin}
							>
								Join
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	)
}
