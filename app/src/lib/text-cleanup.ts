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
 * Check if text contains markdown formatting (headings, bold, etc.)
 */
export function hasMarkdownPatterns(text: string): boolean {
	const lines = text.split('\n')
	return lines.some(
		(line) =>
			/^#{1,3}\s+/.test(line) ||
			/\*\*[^*]+\*\*/.test(line) ||
			/^>\s+/.test(line) ||
			/^---\s*$/.test(line.trim()) ||
			/^```/.test(line.trim()) ||
			/\[.+?\]\(.+?\)/.test(line)
	)
}

/**
 * Parse inline markdown (bold, italic, code, links, strikethrough) into TipTap text nodes with marks.
 */
export function parseInlineMarkdown(text: string): TipTapNode[] {
	if (!text) return []

	const nodes: TipTapNode[] = []
	// Regex matches: **bold**, *italic*, ~~strike~~, `code`, [text](url)
	const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|\[(.+?)\]\((.+?)\))/g
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = inlineRegex.exec(text)) !== null) {
		// Add plain text before the match
		if (match.index > lastIndex) {
			nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
		}

		if (match[2]) {
			// **bold**
			nodes.push({ type: 'text', text: match[2], marks: [{ type: 'bold' }] })
		} else if (match[3]) {
			// *italic*
			nodes.push({ type: 'text', text: match[3], marks: [{ type: 'italic' }] })
		} else if (match[4]) {
			// ~~strikethrough~~
			nodes.push({ type: 'text', text: match[4], marks: [{ type: 'strike' }] })
		} else if (match[5]) {
			// `code`
			nodes.push({ type: 'text', text: match[5], marks: [{ type: 'code' }] })
		} else if (match[6] && match[7]) {
			// [text](url)
			nodes.push({ type: 'text', text: match[6], marks: [{ type: 'link', attrs: { href: match[7] } }] })
		}

		lastIndex = match.index + match[0].length
	}

	// Add remaining plain text
	if (lastIndex < text.length) {
		nodes.push({ type: 'text', text: text.slice(lastIndex) })
	}

	return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

/**
 * Create a paragraph or heading node with inline markdown parsing.
 */
function makeTextBlock(type: string, text: string, attrs?: Record<string, unknown>): TipTapNode {
	const content = parseInlineMarkdown(text)
	return { type, content, ...(attrs ? { attrs } : {}) }
}

/**
 * Parse a table cell's text content. Handles checkboxes [ ] / [x] and inline markdown.
 */
function parseCellContent(text: string): TipTapNode[] {
	if (!text) return []

	// Checkbox: [ ] or [x] or [X]
	const checkMatch = text.match(/^\[([ xX])\]\s*(.*)/)
	if (checkMatch) {
		const checked = checkMatch[1].toLowerCase() === 'x'
		const rest = checkMatch[2]
		const nodes: TipTapNode[] = [{ type: 'inlineCheckbox', attrs: { checked } }]
		if (rest) {
			nodes.push({ type: 'text', text: ' ' })
			nodes.push(...parseInlineMarkdown(rest))
		}
		return nodes
	}

	return parseInlineMarkdown(text)
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
 * Check if text contains a markdown table pattern.
 */
export function hasTablePattern(text: string): boolean {
	const lines = text.split('\n').filter((l) => l.trim())
	if (lines.length < 2) return false
	// Need at least a header row and a separator row with pipes and dashes
	return lines.some((line) => /^\|.*\|$/.test(line.trim())) &&
		lines.some((line) => /^\|[\s\-:|]+\|$/.test(line.trim()))
}

/**
 * Parse a markdown table into TipTap table JSON node.
 */
export function parseMarkdownTable(lines: string[]): TipTapNode | null {
	// Filter to only lines that look like table rows
	const tableLines = lines
		.map((l) => l.trim())
		.filter((l) => l.startsWith('|') && l.endsWith('|'))
	if (tableLines.length < 2) return null

	// Find the separator row (e.g. |---|---|)
	const sepIdx = tableLines.findIndex((l) =>
		/^\|[\s\-:|]+\|$/.test(l)
	)
	if (sepIdx < 1) return null

	function parseCells(line: string): string[] {
		return line
			.slice(1, -1) // remove leading/trailing |
			.split('|')
			.map((c) => c.trim())
	}

	const headerRows = tableLines.slice(0, sepIdx)
	const bodyRows = tableLines.slice(sepIdx + 1)

	const rows: TipTapNode[] = []

	// Header rows
	for (const row of headerRows) {
		const cells = parseCells(row)
		rows.push({
			type: 'tableRow',
			content: cells.map((cell) => ({
				type: 'tableHeader',
				content: [
					{
						type: 'paragraph',
						content: cell ? parseCellContent(cell) : undefined,
					},
				],
			})),
		})
	}

	// Body rows
	for (const row of bodyRows) {
		const cells = parseCells(row)
		rows.push({
			type: 'tableRow',
			content: cells.map((cell) => ({
				type: 'tableCell',
				content: [
					{
						type: 'paragraph',
						content: cell ? parseCellContent(cell) : undefined,
					},
				],
			})),
		})
	}

	if (rows.length === 0) return null
	return { type: 'table', content: rows }
}

/**
 * Parse lines of plain text / markdown into TipTap JSON nodes.
 * Handles headings, bold/italic/links, lists, tables, blockquotes,
 * code blocks, and horizontal rules.
 */
export function parseLinesToNodes(lines: string[]): TipTapNode[] {
	const nodes: TipTapNode[] = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]

		// Code block: ```
		if (/^\s*```/.test(line)) {
			const codeLines: string[] = []
			i++ // skip opening ```
			while (i < lines.length && !/^\s*```/.test(lines[i])) {
				codeLines.push(lines[i])
				i++
			}
			if (i < lines.length) i++ // skip closing ```
			nodes.push({
				type: 'codeBlock',
				content: codeLines.length > 0
					? [{ type: 'text', text: codeLines.join('\n') }]
					: undefined,
			})
			continue
		}

		// Horizontal rule: ---, ***, ___
		if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
			nodes.push({ type: 'horizontalRule' })
			i++
			continue
		}

		// Heading: # ## ###
		const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
		if (headingMatch) {
			const level = headingMatch[1].length
			nodes.push(makeTextBlock('heading', headingMatch[2].trim(), { level }))
			i++
			continue
		}

		// Blockquote: > text
		if (/^\s*>\s+/.test(line)) {
			const quoteLines: string[] = []
			while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
				quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
				i++
			}
			const innerNodes = parseLinesToNodes(quoteLines)
			nodes.push({
				type: 'blockquote',
				content: innerNodes.length > 0 ? innerNodes : [{ type: 'paragraph' }],
			})
			continue
		}

		// Markdown table: lines starting and ending with |
		if (/^\s*\|.*\|\s*$/.test(line)) {
			const tableLines: string[] = []
			while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
				tableLines.push(lines[i])
				i++
			}
			const table = parseMarkdownTable(tableLines)
			if (table) {
				nodes.push(table)
				continue
			}
			// Not a valid table, fall through and reprocess
			i -= tableLines.length
		}

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
					content: [makeTextBlock('paragraph', text)],
				})
				i++
			}
			nodes.push({ type: 'taskList', content: taskItems })
			continue
		}

		// Bullet list: - text, • text (but NOT * text since * is italic marker)
		// Use - or • for bullets; standalone * lines are treated as bullets only if followed by space+text
		if (/^\s*[-•]\s+/.test(line) || /^\s*\*\s+[^*]/.test(line)) {
			const listItems: TipTapNode[] = []
			while (i < lines.length) {
				const bm = lines[i].match(/^\s*[-*•]\s+(.*)/)
				if (!bm) break
				if (/^\s*[-*•]\s+\[[ xX]\]\s+/.test(lines[i])) break
				const text = bm[1].trim()
				listItems.push({
					type: 'listItem',
					content: [makeTextBlock('paragraph', text)],
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
					content: [makeTextBlock('paragraph', text)],
				})
				i++
			}
			nodes.push({ type: 'orderedList', content: listItems })
			continue
		}

		// Regular text line — parse inline markdown
		// Skip blank lines — block elements already have CSS margins
		const trimmed = line.trim()
		if (trimmed) {
			nodes.push(makeTextBlock('paragraph', trimmed))
		}
		i++
	}

	return nodes
}

/**
 * Strip all leading whitespace from text nodes in the document.
 * Useful for pasted text that has unwanted indentation.
 */
export function alignLeftContent(json: TipTapNode): TipTapNode {
	if (!json) return json

	if (json.type === 'text' && json.text) {
		return { ...json, text: json.text.replace(/^[\t ]+/gm, '') }
	}

	if (!json.content) return json

	return {
		...json,
		content: json.content.map((child) => alignLeftContent(child)),
	}
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
