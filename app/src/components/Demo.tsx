import { createSignal, createResource, For, Show } from 'solid-js'
import { Box, Flex, VStack } from '../../styled-system/jsx'
import { styled } from '../../styled-system/jsx'
import { css } from '../../styled-system/css'

interface Note {
	id: number
	title: string
	content: string | null
	created_at: string
	updated_at: string
}

async function fetchNotes(): Promise<Note[]> {
	return window.electronAPI.fetchAllNotes()
}

const inputStyle = css({
	px: '3', py: '2', borderWidth: '1px', borderStyle: 'solid',
	borderColor: 'gray.6', borderRadius: 'md',
	outline: 'none', color: 'gray.12',
	_focus: { borderColor: 'blue.500' },
	bg: "gray.2"
})

export default function Demo() {
	// IPC Ping
	const [pingResult, setPingResult] = createSignal('')
	const handlePing = async () => {
		const result = await window.electronAPI.ping()
		setPingResult(result)
	}

	// Dark Mode
	const handleDarkModeToggle = () => {
		window.electronAPI.darkModeToggle()
	}

	// Notes
	const [notes, { refetch }] = createResource(fetchNotes)
	const [newTitle, setNewTitle] = createSignal('')
	const [newContent, setNewContent] = createSignal('')
	const [editingId, setEditingId] = createSignal<number | null>(null)
	const [editTitle, setEditTitle] = createSignal('')
	const [editContent, setEditContent] = createSignal('')

	const handleCreateNote = async () => {
		const title = newTitle().trim()
		if (!title) return
		await window.electronAPI.createNote(title, newContent() || null)
		setNewTitle('')
		setNewContent('')
		refetch()
	}

	const handleDeleteNote = async (id: number) => {
		await window.electronAPI.deleteNote(id)
		refetch()
	}

	const startEditing = (note: Note) => {
		setEditingId(note.id)
		setEditTitle(note.title)
		setEditContent(note.content || '')
	}

	const handleUpdateNote = async () => {
		const id = editingId()
		if (id === null) return
		await window.electronAPI.updateNote(id, editTitle(), editContent() || null)
		setEditingId(null)
		refetch()
	}

	const cancelEdit = () => {
		setEditingId(null)
	}

	return (
		<Box maxWidth="700px" mx="auto" p="8" fontFamily="sans-serif" color="gray.12">
			<styled.h1 fontSize="2xl" fontWeight="bold" mb="6" color="gray.12">
				Astro + SolidJS + Electron + Park UI
			</styled.h1>

			{/* Section 1: IPC Demo */}
			<Box mb="8" p="5" borderRadius="lg" border="1px solid" borderColor="gray.6">
				<styled.h2 fontSize="lg" fontWeight="semibold" mb="3" color="gray.12">IPC Demo</styled.h2>
				<Flex alignItems="center" gap="3">
					<styled.button
						onClick={handlePing}
						px="4" py="2" bg="blue.600" color="white"
						borderRadius="md" cursor="pointer" fontWeight="medium"
						_hover={{ bg: 'blue.700' }}
					>
						Ping Main Process
					</styled.button>
					<Show when={pingResult()}>
						<styled.span color="green.9" fontWeight="medium">
							Response: "{pingResult()}"
						</styled.span>
					</Show>
				</Flex>
			</Box>

			{/* Section 2: Dark Mode */}
			<Box mb="8" p="5" borderRadius="lg" border="1px solid" borderColor="gray.6">
				<styled.h2 fontSize="lg" fontWeight="semibold" mb="3" color="gray.12">Dark Mode</styled.h2>
				<styled.button
					onClick={handleDarkModeToggle}
					px="4" py="2" bg="gray.solid.bg" color="gray.solid.fg"
					borderRadius="md" cursor="pointer" fontWeight="medium"
					_hover={{ bg: 'gray.solid.bg.hover' }}
				>
					Toggle Dark Mode
				</styled.button>
			</Box>

			{/* Section 3: Notes CRUD */}
			<Box p="5" borderRadius="lg" border="1px solid" borderColor="gray.6">
				<styled.h2 fontSize="lg" fontWeight="semibold" mb="4" color="gray.12">Notes (SQLite)</styled.h2>

				{/* Create Note Form */}
				<VStack gap="2" mb="4" alignItems="stretch">
					<styled.input
						type="text"
						placeholder="Note title"
						value={newTitle()}
						onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setNewTitle(e.currentTarget.value)}
						class={inputStyle}
					/>
					<styled.textarea
						placeholder="Note content (optional)"
						value={newContent()}
						onInput={(e: InputEvent & { currentTarget: HTMLTextAreaElement }) => setNewContent(e.currentTarget.value)}
						px="3" py="2" border="1px solid"
						borderColor="gray.6" borderRadius="md"
						outline="none" resize="vertical" minHeight="80px" color="gray.12"
						_focus={{ borderColor: 'blue.500' }}
						bg="gray.2"
					/>
					<styled.button
						onClick={handleCreateNote}
						px="4" py="2" bg="green.600" color="white"
						borderRadius="md" cursor="pointer" fontWeight="medium"
						_hover={{ bg: 'green.700' }} alignSelf="flex-start"
					>
						Add Note
					</styled.button>
				</VStack>

				{/* Notes List */}
				<Show when={!notes.loading} fallback={<styled.p color="gray.11">Loading notes...</styled.p>}>
					<Show when={notes()?.length} fallback={<styled.p color="gray.11">No notes yet. Create one above!</styled.p>}>
						<VStack gap="3" alignItems="stretch">
							<For each={notes()}>
								{(note) => (
									<Box
										p="4" borderRadius="md"
										border="1px solid" borderColor="gray.5"
										bg="gray.2"
									>
										<Show
											when={editingId() === note.id}
											fallback={
												<Flex justifyContent="space-between" alignItems="flex-start">
													<Box>
														<styled.h3 fontWeight="semibold" mb="1" color="gray.12">{note.title}</styled.h3>
														<Show when={note.content}>
															<styled.p color="gray.11" fontSize="sm">{note.content}</styled.p>
														</Show>
													</Box>
													<Flex gap="2" flexShrink="0">
														<styled.button
															onClick={() => startEditing(note)}
															px="3" py="1" fontSize="sm"
															bg="gray.subtle.bg" color="gray.12"
															borderRadius="md" cursor="pointer"
															_hover={{ bg: 'gray.subtle.bg.hover' }}
														>
															Edit
														</styled.button>
														<styled.button
															onClick={() => handleDeleteNote(note.id)}
															px="3" py="1" fontSize="sm"
															bg="red.subtle.bg" color="red.subtle.fg"
															borderRadius="md" cursor="pointer"
															_hover={{ bg: 'red.subtle.bg.hover' }}
														>
															Delete
														</styled.button>
													</Flex>
												</Flex>
											}
										>
											{/* Edit form */}
											<VStack gap="2" alignItems="stretch">
												<styled.input
													type="text"
													value={editTitle()}
													onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setEditTitle(e.currentTarget.value)}
													class={inputStyle}
												/>
												<styled.textarea
													value={editContent()}
													onInput={(e: InputEvent & { currentTarget: HTMLTextAreaElement }) => setEditContent(e.currentTarget.value)}
													px="3" py="2" border="1px solid"
													borderColor="gray.6" borderRadius="md"
													outline="none" resize="vertical" minHeight="60px" color="gray.12"
													_focus={{ borderColor: 'blue.500' }}
												/>
												<Flex gap="2">
													<styled.button
														onClick={handleUpdateNote}
														px="3" py="1" fontSize="sm" bg="green.600" color="white"
														borderRadius="md" cursor="pointer"
														_hover={{ bg: 'green.700' }}
													>
														Save
													</styled.button>
													<styled.button
														onClick={cancelEdit}
														px="3" py="1" fontSize="sm"
														bg="gray.subtle.bg" color="gray.12"
														borderRadius="md" cursor="pointer"
														_hover={{ bg: 'gray.subtle.bg.hover' }}
													>
														Cancel
													</styled.button>
												</Flex>
											</VStack>
										</Show>
									</Box>
								)}
							</For>
						</VStack>
					</Show>
				</Show>
			</Box>
		</Box>
	)
}
