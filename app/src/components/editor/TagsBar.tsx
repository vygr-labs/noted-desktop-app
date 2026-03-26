import { createSignal, createResource, For, Show } from 'solid-js'
import { css } from '../../../styled-system/css'
import { useAppStore } from '../../stores/app-store'
import { PlusIcon, XIcon } from 'lucide-solid'

const barStyle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	flexWrap: 'wrap',
	flexShrink: 0,
	mb: '4',
})

const tagChip = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
	px: '2.5',
	py: '1',
	borderRadius: 'full',
	fontSize: '12px',
	fontWeight: '500',
	bg: 'indigo.a2',
	color: 'indigo.11',
	transition: 'all 0.15s',
	_hover: { bg: 'indigo.a3' },
})

const removeBtn = css({
	display: 'flex',
	alignItems: 'center',
	cursor: 'pointer',
	color: 'indigo.8',
	_hover: { color: 'indigo.11' },
})

const addTagBtn = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1',
	px: '2.5',
	py: '1',
	borderRadius: 'full',
	fontSize: '12px',
	fontWeight: '500',
	cursor: 'pointer',
	color: 'fg.subtle',
	borderWidth: '1px',
	borderStyle: 'dashed',
	borderColor: 'gray.a4',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a2', color: 'fg.default', borderColor: 'gray.a6' },
})

const tagInput = css({
	fontSize: '12px',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'indigo.a5',
	borderRadius: 'full',
	px: '3',
	py: '1',
	bg: 'bg.default',
	color: 'fg.default',
	outline: 'none',
	width: '110px',
	_focus: { borderColor: 'indigo.9', boxShadow: '0 0 0 3px {colors.indigo.a2}' },
})

export function TagsBar(props: { noteId: string; readonly?: boolean }) {
	const appStore = useAppStore()
	const [showInput, setShowInput] = createSignal(false)
	const [inputValue, setInputValue] = createSignal('')

	const [tags, { refetch: refetchTags }] = createResource(
		() => props.noteId,
		async (noteId: string) => {
			return window.electronAPI.fetchTagsForNote(noteId)
		}
	)

	async function handleAddTag() {
		const name = inputValue().trim()
		if (!name) {
			setShowInput(false)
			return
		}

		// Find or create the tag
		const allTags = await window.electronAPI.fetchAllTags()
		let tag = allTags.find(
			(t: Tag) => t.name.toLowerCase() === name.toLowerCase()
		)
		if (!tag) {
			tag = await window.electronAPI.createTag(name)
			appStore.refetchTags()
		}

		await window.electronAPI.addTagToNote(props.noteId, tag.id)
		refetchTags()
		setInputValue('')
		setShowInput(false)
	}

	async function handleRemoveTag(tagId: string) {
		await window.electronAPI.removeTagFromNote(props.noteId, tagId)
		refetchTags()
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAddTag()
		if (e.key === 'Escape') {
			setShowInput(false)
			setInputValue('')
		}
	}

	return (
		<div class={barStyle}>
			<For each={tags()}>
				{(tag) => (
					<span class={tagChip}>
						{tag.name}
						<Show when={!props.readonly}>
							<span
								class={removeBtn}
								onClick={() => handleRemoveTag(tag.id)}
							>
								<XIcon
									class={css({ width: '3', height: '3' })}
								/>
							</span>
						</Show>
					</span>
				)}
			</For>
			<Show when={!props.readonly}>
				<Show
					when={showInput()}
					fallback={
						<button
							class={addTagBtn}
							onClick={() => setShowInput(true)}
						>
							<PlusIcon
								class={css({ width: '3', height: '3' })}
							/>
							Tag
						</button>
					}
				>
					<input
						class={tagInput}
						value={inputValue()}
						onInput={(e) => setInputValue(e.currentTarget.value)}
						onKeyDown={handleKeyDown}
						onBlur={handleAddTag}
						placeholder="Tag name"
						autofocus
					/>
				</Show>
			</Show>
		</div>
	)
}
