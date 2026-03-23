interface TipTapNode {
	type: string
	content?: TipTapNode[]
	text?: string
	attrs?: Record<string, unknown>
}

export function tiptapToPlaintext(json: string | null): string {
	if (!json) return ''
	try {
		const doc: TipTapNode = typeof json === 'string' ? JSON.parse(json) : json
		return extractText(doc).trim()
	} catch {
		return ''
	}
}

function extractText(node: TipTapNode): string {
	if (node.text) return node.text
	if (!node.content) return ''

	// Handle table rows: join cells with tab
	if (node.type === 'tableRow') {
		return node.content
			.map((cell) => extractText(cell).trim())
			.join('\t') + '\n'
	}

	return node.content
		.map((child) => {
			const text = extractText(child)
			if (
				child.type === 'paragraph' ||
				child.type === 'heading' ||
				child.type === 'taskItem' ||
				child.type === 'listItem' ||
				child.type === 'blockquote' ||
				child.type === 'codeBlock' ||
				child.type === 'table'
			) {
				return text + '\n'
			}
			return text
		})
		.join('')
}
