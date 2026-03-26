import { createSignal, For, Show, onMount, onCleanup } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { SearchIcon, FileTextIcon, ClockIcon } from 'lucide-solid'

const overlay = css({
	position: 'fixed',
	inset: 0,
	bg: 'rgba(0, 0, 0, 0.5)',
	display: 'flex',
	alignItems: 'flex-start',
	justifyContent: 'center',
	pt: '20vh',
	zIndex: 100,
	animation: 'overlay-enter 0.15s ease-out',
})

const palette = css({
	bg: 'gray.2',
	borderRadius: 'xl',
	width: '560px',
	maxHeight: '420px',
	overflow: 'hidden',
	boxShadow: '0 24px 64px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px {colors.gray.a3}',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
	display: 'flex',
	flexDirection: 'column',
})

const searchRow = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
	px: '4',
	py: '3',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a3',
})

const searchIconStyle = css({
	width: '5',
	height: '5',
	color: 'fg.subtle',
	flexShrink: 0,
})

const searchInput = css({
	flex: 1,
	fontSize: 'md',
	color: 'fg.default',
	bg: 'transparent',
	border: 'none',
	outline: 'none',
	'&::placeholder': { color: 'fg.muted' },
})

const kbdEsc = css({
	fontSize: '10px',
	fontWeight: '500',
	fontFamily: 'mono',
	color: 'fg.muted',
	bg: 'gray.a3',
	borderRadius: 'sm',
	px: '1.5',
	py: '0.5',
	flexShrink: 0,
})

const resultsArea = css({
	flex: 1,
	overflowY: 'auto',
	py: '1',
})

const sectionLabel = css({
	px: '4',
	py: '1.5',
	fontSize: '10px',
	fontWeight: 'bold',
	textTransform: 'uppercase',
	letterSpacing: '0.08em',
	color: 'fg.subtle',
})

const resultItem = css({
	display: 'flex',
	alignItems: 'center',
	gap: '3',
	px: '4',
	py: '2.5',
	cursor: 'pointer',
	transition: 'all 0.1s',
	_hover: { bg: 'indigo.a2' },
	'&[data-selected="true"]': {
		bg: 'indigo.a3',
	},
})

const resultIcon = css({
	width: '4',
	height: '4',
	color: 'fg.subtle',
	flexShrink: 0,
})

const resultContent = css({
	flex: 1,
	minWidth: 0,
})

const resultTitle = css({
	fontSize: 'sm',
	fontWeight: '500',
	color: 'fg.default',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
})

const resultSnippet = css({
	fontSize: 'xs',
	color: 'fg.muted',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	mt: '0.5',
	'& mark': {
		bg: 'indigo.a3',
		color: 'indigo.11',
		borderRadius: '2px',
		px: '1px',
	},
})

const resultMeta = css({
	fontSize: '11px',
	color: 'fg.muted',
	flexShrink: 0,
})

const emptyResults = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	py: '8',
	gap: '2',
})

const emptyText = css({
	fontSize: 'sm',
	color: 'fg.muted',
})

const footer = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: '4',
	py: '2',
	borderTop: '1px solid',
	borderTopColor: 'gray.a3',
	fontSize: '11px',
	color: 'fg.muted',
})

export function CommandPalette() {
	const store = useAppStore()
	const [query, setQuery] = createSignal('')
	const [results, setResults] = createSignal<SearchResult[]>([])
	const [selectedIndex, setSelectedIndex] = createSignal(0)
	let inputRef: HTMLInputElement | undefined

	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	function handleInput(value: string) {
		setQuery(value)
		setSelectedIndex(0)
		if (debounceTimer) clearTimeout(debounceTimer)
		if (!value.trim()) {
			setResults([])
			return
		}
		debounceTimer = setTimeout(async () => {
			const res = await window.electronAPI.searchNotes(value)
			setResults(res || [])
		}, 150)
	}

	function handleSelect(result: SearchResult) {
		store.setCurrentView('all')
		store.setSelectedNoteId(result.note_id)
		store.setCommandPaletteOpen(false)
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			store.setCommandPaletteOpen(false)
		} else if (e.key === 'ArrowDown') {
			e.preventDefault()
			setSelectedIndex((i) => Math.min(i + 1, results().length - 1))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setSelectedIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			const r = results()[selectedIndex()]
			if (r) handleSelect(r)
		}
	}

	// Also browse all notes if query is empty
	const recentNotes = () => {
		if (query().trim()) return []
		return (store.notes() || []).slice(0, 8)
	}

	onMount(() => {
		inputRef?.focus()
	})

	return (
		<div
			class={overlay}
			onClick={() => store.setCommandPaletteOpen(false)}
		>
			<div class={palette} onClick={(e) => e.stopPropagation()}>
				<div class={searchRow}>
					<SearchIcon class={searchIconStyle} />
					<input
						ref={inputRef}
						class={searchInput}
						value={query()}
						onInput={(e) => handleInput(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search notes..."
						autofocus
					/>
					<span class={kbdEsc}>ESC</span>
				</div>

				<div class={resultsArea}>
					{/* Search results */}
					<Show when={query().trim() && results().length > 0}>
						<div class={sectionLabel}>Results</div>
						<For each={results()}>
							{(result, i) => (
								<div
									class={resultItem}
									data-selected={selectedIndex() === i()}
									onClick={() => handleSelect(result)}
									onMouseEnter={() => setSelectedIndex(i())}
								>
									<FileTextIcon class={resultIcon} />
									<div class={resultContent}>
										<div class={resultTitle}>{result.title}</div>
										<div
											class={resultSnippet}
											innerHTML={result.snippet}
										/>
									</div>
								</div>
							)}
						</For>
					</Show>

					{/* No results */}
					<Show when={query().trim() && results().length === 0}>
						<div class={emptyResults}>
							<SearchIcon class={css({ width: '8', height: '8', color: 'gray.a4' })} />
							<span class={emptyText}>No notes found</span>
						</div>
					</Show>

					{/* Recent notes when no query */}
					<Show when={!query().trim() && recentNotes().length > 0}>
						<div class={sectionLabel}>Recent Notes</div>
						<For each={recentNotes()}>
							{(note, i) => (
								<div
									class={resultItem}
									data-selected={selectedIndex() === i()}
									onClick={() => {
										store.setCurrentView('all')
										store.setSelectedNoteId(note.id)
										store.setCommandPaletteOpen(false)
									}}
									onMouseEnter={() => setSelectedIndex(i())}
								>
									<ClockIcon class={resultIcon} />
									<div class={resultContent}>
										<div class={resultTitle}>
											{note.title || 'Untitled'}
										</div>
										<Show when={note.content_plain}>
											<div class={resultSnippet}>
												{note.content_plain?.slice(0, 80)}
											</div>
										</Show>
									</div>
									<span class={resultMeta}>
										{new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
									</span>
								</div>
							)}
						</For>
					</Show>
				</div>

				<div class={footer}>
					<span>Type to search across all notes</span>
					<span class={css({ display: 'flex', gap: '1.5', alignItems: 'center' })}>
						<span class={css({ fontFamily: 'mono' })}>Enter</span> to select
					</span>
				</div>
			</div>
		</div>
	)
}
