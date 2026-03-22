// ─── Text cleanup & formatting utilities ────────────────

interface TipTapNode {
	type: string
	content?: TipTapNode[]
	text?: string
	attrs?: Record<string, unknown>
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

function getNodeText(node: TipTapNode): string {
	if (node.text) return node.text
	if (!node.content) return ''
	return node.content.map(getNodeText).join('')
}

function isEmptyNode(node: TipTapNode): boolean {
	if (node.type !== 'paragraph') return false
	if (!node.content || node.content.length === 0) return true
	return getNodeText(node).trim() === ''
}

/**
 * Check if text contains list-like lines that should be auto-formatted.
 */
export function hasListPatterns(text: string): boolean {
	const lines = text.split('\n')
	return lines.some(
		(line) =>
			/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)
	)
}

/**
 * Parse lines of plain text into TipTap JSON nodes.
 * Converts "- text" → bullet list, "1. text" → ordered list,
 * "- [ ] text" / "- [x] text" → task list.
 */
export function parseLinesToNodes(lines: string[]): TipTapNode[] {
	const nodes: TipTapNode[] = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]

		// Task list: - [ ] or - [x]
		if (/^\s*[-*•]\s+\[[ xX]\]\s+/.test(line)) {
			const taskItems: TipTapNode[] = []
			while (i < lines.length) {
				const tm = lines[i].match(/^\s*[-*•]\s+\[([ xX])\]\s+(.*)/)
				if (!tm) break
				const checked = tm[1].toLowerCase() === 'x'
				const text = tm[2].trim()
				taskItems.push({
					type: 'taskItem',
					attrs: { checked },
					content: [
						{
							type: 'paragraph',
							content: text ? [{ type: 'text', text }] : undefined,
						},
					],
				})
				i++
			}
			nodes.push({ type: 'taskList', content: taskItems })
			continue
		}

		// Bullet list: - text, * text, • text
		if (/^\s*[-*•]\s+/.test(line)) {
			const listItems: TipTapNode[] = []
			while (i < lines.length) {
				const bm = lines[i].match(/^\s*[-*•]\s+(.*)/)
				if (!bm) break
				// Stop if this is actually a task item
				if (/^\s*[-*•]\s+\[[ xX]\]\s+/.test(lines[i])) break
				const text = bm[1].trim()
				listItems.push({
					type: 'listItem',
					content: [
						{
							type: 'paragraph',
							content: text ? [{ type: 'text', text }] : undefined,
						},
					],
				})
				i++
			}
			nodes.push({ type: 'bulletList', content: listItems })
			continue
		}

		// Ordered list: 1. text, 2) text
		if (/^\s*\d+[.)]\s+/.test(line)) {
			const listItems: TipTapNode[] = []
			while (i < lines.length) {
				const om = lines[i].match(/^\s*\d+[.)]\s+(.*)/)
				if (!om) break
				const text = om[1].trim()
				listItems.push({
					type: 'listItem',
					content: [
						{
							type: 'paragraph',
							content: text ? [{ type: 'text', text }] : undefined,
						},
					],
				})
				i++
			}
			nodes.push({ type: 'orderedList', content: listItems })
			continue
		}

		// Regular text line
		const trimmed = line.trim()
		if (trimmed) {
			nodes.push({
				type: 'paragraph',
				content: [{ type: 'text', text: trimmed }],
			})
		} else if (nodes.length > 0) {
			// Blank line → empty paragraph for spacing
			nodes.push({ type: 'paragraph' })
		}
		i++
	}

	return nodes
}

/**
 * Clean and format TipTap JSON content:
 * - Convert "- text" paragraphs → bullet lists
 * - Convert "1. text" paragraphs → ordered lists
 * - Convert "- [ ] text" paragraphs → task lists
 * - Collapse consecutive empty paragraphs into one
 * - Trim excess whitespace in text nodes
 */
export function cleanTipTapContent(json: TipTapNode): TipTapNode {
	if (!json || !json.content) return json

	const newContent: TipTapNode[] = []
	let i = 0

	while (i < json.content.length) {
		const node = json.content[i]
		const text = getNodeText(node)

		// Convert paragraph with task pattern → task list
		if (node.type === 'paragraph' && /^\s*[-*•]\s+\[[ xX]\]\s+/.test(text)) {
			const taskItems: TipTapNode[] = []
			while (i < json.content.length) {
				const n = json.content[i]
				const t = getNodeText(n)
				const tm = t.match(/^\s*[-*•]\s+\[([ xX])\]\s+(.*)/)
				if (n.type !== 'paragraph' || !tm) break
				taskItems.push({
					type: 'taskItem',
					attrs: { checked: tm[1].toLowerCase() === 'x' },
					content: [
						{
							type: 'paragraph',
							content: tm[2].trim()
								? [{ type: 'text', text: tm[2].trim() }]
								: undefined,
						},
					],
				})
				i++
			}
			newContent.push({ type: 'taskList', content: taskItems })
			continue
		}

		// Convert paragraph with bullet pattern → bullet list
		if (node.type === 'paragraph' && /^\s*[-*•]\s+/.test(text)) {
			const listItems: TipTapNode[] = []
			while (i < json.content.length) {
				const n = json.content[i]
				const t = getNodeText(n)
				const bm = t.match(/^\s*[-*•]\s+(.*)/)
				if (n.type !== 'paragraph' || !bm) break
				if (/^\s*[-*•]\s+\[[ xX]\]\s+/.test(t)) break
				listItems.push({
					type: 'listItem',
					content: [
						{
							type: 'paragraph',
							content: bm[1].trim()
								? [{ type: 'text', text: bm[1].trim() }]
								: undefined,
						},
					],
				})
				i++
			}
			newContent.push({ type: 'bulletList', content: listItems })
			continue
		}

		// Convert paragraph with ordered list pattern → ordered list
		if (node.type === 'paragraph' && /^\s*\d+[.)]\s+/.test(text)) {
			const listItems: TipTapNode[] = []
			while (i < json.content.length) {
				const n = json.content[i]
				const t = getNodeText(n)
				const om = t.match(/^\s*\d+[.)]\s+(.*)/)
				if (n.type !== 'paragraph' || !om) break
				listItems.push({
					type: 'listItem',
					content: [
						{
							type: 'paragraph',
							content: om[1].trim()
								? [{ type: 'text', text: om[1].trim() }]
								: undefined,
						},
					],
				})
				i++
			}
			newContent.push({ type: 'orderedList', content: listItems })
			continue
		}

		// Collapse consecutive empty paragraphs
		if (isEmptyNode(node)) {
			const prev = newContent[newContent.length - 1]
			if (prev && isEmptyNode(prev)) {
				i++
				continue
			}
		}

		// Trim whitespace in paragraph text
		if (node.type === 'paragraph' && node.content) {
			const cleanedContent = node.content
				.map((child) => {
					if (child.type === 'text' && child.text) {
						return {
							...child,
							text: child.text
								.replace(/^\s+|\s+$/g, '')
								.replace(/\s{2,}/g, ' '),
						}
					}
					return child
				})
				.filter((child) => !(child.type === 'text' && child.text === ''))

			newContent.push({
				...node,
				content: cleanedContent.length > 0 ? cleanedContent : undefined,
			})
		} else if (node.content) {
			// Recursively clean nested content (list items, blockquotes, etc.)
			newContent.push(cleanTipTapContent(node))
		} else {
			newContent.push(node)
		}

		i++
	}

	// Remove trailing empty paragraphs
	while (
		newContent.length > 1 &&
		isEmptyNode(newContent[newContent.length - 1])
	) {
		newContent.pop()
	}

	return { ...json, content: newContent }
}
