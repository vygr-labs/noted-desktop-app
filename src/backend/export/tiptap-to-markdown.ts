// ─── TipTap JSON → Markdown converter ────────────────────

interface TipTapNode {
	type: string
	content?: TipTapNode[]
	text?: string
	attrs?: Record<string, unknown>
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

function renderMarks(
	text: string,
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
): string {
	if (!marks || marks.length === 0) return text

	let result = text
	for (const mark of marks) {
		switch (mark.type) {
			case 'bold':
				result = `**${result}**`
				break
			case 'italic':
				result = `*${result}*`
				break
			case 'strike':
				result = `~~${result}~~`
				break
			case 'code':
				result = `\`${result}\``
				break
			case 'link':
				result = `[${result}](${mark.attrs?.href || ''})`
				break
		}
	}
	return result
}

function renderTable(node: TipTapNode): string {
	const rows = node.content || []
	if (rows.length === 0) return ''

	const tableData = rows.map((row) =>
		(row.content || []).map((cell) =>
			(cell.content || []).map((c) => renderNode(c)).join('').trim()
		)
	)

	const colCount = Math.max(...tableData.map((r) => r.length))
	let result = ''

	tableData.forEach((row, rowIdx) => {
		const cells = Array.from({ length: colCount }, (_, i) => row[i] || '')
		result += '| ' + cells.join(' | ') + ' |\n'
		if (rowIdx === 0) {
			result += '| ' + cells.map(() => '---').join(' | ') + ' |\n'
		}
	})

	return result + '\n'
}

function renderNode(node: TipTapNode): string {
	if (node.type === 'text') {
		return renderMarks(node.text || '', node.marks)
	}

	const children = () => (node.content || []).map(renderNode).join('')

	switch (node.type) {
		case 'doc':
			return children()
		case 'paragraph':
			return children() + '\n\n'
		case 'heading': {
			const level = Number(node.attrs?.level || 1)
			return '#'.repeat(level) + ' ' + children().trim() + '\n\n'
		}
		case 'bulletList':
			return (
				(node.content || [])
					.map((item) => {
						const content = (item.content || [])
							.map(renderNode)
							.join('')
							.trim()
						return `- ${content}\n`
					})
					.join('') + '\n'
			)
		case 'orderedList':
			return (
				(node.content || [])
					.map((item, i) => {
						const content = (item.content || [])
							.map(renderNode)
							.join('')
							.trim()
						return `${i + 1}. ${content}\n`
					})
					.join('') + '\n'
			)
		case 'taskList':
			return (
				(node.content || [])
					.map((item) => {
						const checked = item.attrs?.checked ? 'x' : ' '
						const content = (item.content || [])
							.map(renderNode)
							.join('')
							.trim()
						return `- [${checked}] ${content}\n`
					})
					.join('') + '\n'
			)
		case 'codeBlock':
			return '```\n' + (node.content || []).map((c) => c.text || '').join('') + '\n```\n\n'
		case 'blockquote': {
			const inner = children().trim()
			return (
				inner
					.split('\n')
					.map((l) => `> ${l}`)
					.join('\n') + '\n\n'
			)
		}
		case 'horizontalRule':
			return '---\n\n'
		case 'hardBreak':
			return '\n'
		case 'table':
			return renderTable(node)
		case 'listItem':
			return children()
		case 'taskItem':
			return children()
		default:
			return children()
	}
}

export function tiptapToMarkdown(json: string | null): string {
	if (!json) return ''
	try {
		const doc = typeof json === 'string' ? JSON.parse(json) : json
		return renderNode(doc).trim() + '\n'
	} catch {
		return ''
	}
}
