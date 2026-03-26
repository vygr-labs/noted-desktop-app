import { createSignal, For, Show } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { SearchIcon } from 'lucide-solid'
import { EmptyState } from '../shared/EmptyState'

const container = css({
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
	overflow: 'hidden',
})

const searchBar = css({
	px: '4',
	py: '3',
	flexShrink: 0,
})

const searchInputWrap = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	px: '3',
	py: '2',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a4',
	borderRadius: 'lg',
	bg: 'bg.default',
	transition: 'all 0.15s',
	'&:focus-within': {
		borderColor: 'indigo.a6',
		boxShadow: '0 0 0 3px {colors.indigo.a2}',
	},
})

const searchIconStyle = css({
	width: '3.5',
	height: '3.5',
	color: 'fg.muted',
	flexShrink: 0,
})

const searchInput = css({
	flex: 1,
	bg: 'transparent',
	color: 'fg.default',
	fontSize: 'sm',
	outline: 'none',
	border: 'none',
	'&::placeholder': { color: 'fg.muted' },
})

const scrollArea = css({
	flex: 1,
	overflowY: 'auto',
	py: '1',
})

const resultItem = css({
	px: '3',
	py: '2.5',
	mx: '1.5',
	mb: '1',
	borderRadius: 'lg',
	cursor: 'pointer',
	transition: 'all 0.15s',
	border: '1px solid transparent',
	_hover: { bg: 'gray.a2', borderColor: 'gray.a3' },
})

const resultTitle = css({
	fontSize: 'sm',
	fontWeight: '500',
	color: 'fg.default',
	mb: '1',
	letterSpacing: '-0.01em',
})

const resultSnippet = css({
	fontSize: 'xs',
	color: 'fg.muted',
	lineHeight: '1.5',
	'& mark': {
		bg: 'indigo.a3',
		color: 'indigo.11',
		borderRadius: '2px',
		px: '1px',
	},
})

export function SearchResults() {
	const store = useAppStore()
	const [localQuery, setLocalQuery] = createSignal(store.searchQuery())

	let debounceTimer: ReturnType<typeof setTimeout> | null = null
	function handleInput(value: string) {
		setLocalQuery(value)
		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => {
			store.setSearchQuery(value)
		}, 250)
	}

	return (
		<div class={container}>
			<div class={searchBar}>
				<div class={searchInputWrap}>
					<SearchIcon class={searchIconStyle} />
					<input
						class={searchInput}
						value={localQuery()}
						onInput={(e) => handleInput(e.currentTarget.value)}
						placeholder="Search notes..."
						autofocus
					/>
				</div>
			</div>
			<div class={scrollArea}>
				<Show
					when={
						store.searchResults() &&
						store.searchResults()!.length > 0
					}
					fallback={
						<Show when={store.searchQuery().trim()}>
							<EmptyState
								icon={SearchIcon}
								title="No results"
								description="Try a different search term"
							/>
						</Show>
					}
				>
					<For each={store.searchResults()}>
						{(result) => (
							<div
								class={resultItem}
								onClick={() => {
									store.setCurrentView('all')
									store.setSelectedNoteId(result.note_id)
								}}
							>
								<div class={resultTitle}>{result.title}</div>
								<div
									class={resultSnippet}
									innerHTML={result.snippet}
								/>
							</div>
						)}
					</For>
				</Show>
			</div>
		</div>
	)
}
