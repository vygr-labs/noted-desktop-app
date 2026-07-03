// ─── File import → note ──────────────────────────────────
// Turns a text/markdown file (read by the backend) into the note payload
// passed to createNote. Markdown files are parsed into rich TipTap content
// with the same parser the editor uses for pasted markdown; every other text
// file becomes a plain-text note (rendered faithfully as-is, and convertible to
// rich on demand via plainTextToRichContent).

import { parseLinesToNodes } from './text-cleanup'

interface TipTapNode {
	type: string
	content?: TipTapNode[]
	text?: string
	attrs?: Record<string, unknown>
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

// Extensions parsed as markdown into a rich note (a leading "# Heading" is
// lifted out as the title). Every other imported file becomes a plain-text note.
const MARKDOWN_EXTS = new Set(['md', 'markdown', 'mdown', 'mkd'])

const MAX_TITLE_LEN = 200

interface NotePayload {
	title: string
	content: string | null
	content_plain: string | null
	note_type: 'rich' | 'plain'
	list_id: string | null
}

// Flatten a parsed node to plain text for search/preview. Inline runs (text
// nodes within a paragraph/heading) are concatenated; block-level children
// (list items, nested paragraphs, table rows) are separated by newlines so
// distinct items stay searchable rather than fusing into "onetwo".
function nodeText(node: TipTapNode): string {
	if (node.type === 'text') return node.text || ''
	const children = node.content
	if (!children || children.length === 0) return ''
	const hasBlockChildren = children.some((c) => c.type !== 'text')
	const parts = children.map(nodeText).filter((s) => s !== '')
	return parts.join(hasBlockChildren ? '\n' : '')
}

function docPlainText(nodes: TipTapNode[]): string {
	return nodes
		.map(nodeText)
		.filter((s) => s !== '')
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

// Parse raw text/markdown lines into the stored-content pair for a rich note:
// `content` is the serialized TipTap doc (null when there's nothing to render)
// and `content_plain` is its flattened text for search/preview.
function buildRichFromLines(lines: string[]): { content: string | null; content_plain: string | null } {
	const nodes = parseLinesToNodes(lines) as TipTapNode[]
	const content = nodes.length > 0 ? JSON.stringify({ type: 'doc', content: nodes }) : null
	const plain = docPlainText(nodes)
	return { content, content_plain: plain || null }
}

/**
 * Convert an existing plain-text note's body into rich TipTap content, using the
 * same parser as markdown import. Used by "Convert to rich text" so a plain note
 * gains real headings/lists/spacing instead of one unstructured paragraph.
 */
export function plainTextToRichContent(text: string): { content: string | null; content_plain: string | null } {
	return buildRichFromLines(text.split(/\r?\n/))
}

/**
 * Build the createNote payload for an imported file.
 * - Markdown → rich note. A leading `# Heading` becomes the title (and is
 *   dropped from the body); otherwise the filename is used.
 * - Any other text file → plain note titled after the filename.
 */
export function buildNoteFromFile(file: ImportedFile, listId: string | null): NotePayload {
	const fallbackTitle = (file.name && file.name.trim()) || 'Untitled'
	const isMarkdown = MARKDOWN_EXTS.has(file.ext.toLowerCase())

	if (!isMarkdown) {
		return {
			title: fallbackTitle.slice(0, MAX_TITLE_LEN),
			content: null,
			content_plain: file.text,
			note_type: 'plain',
			list_id: listId,
		}
	}

	let bodyLines = file.text.split(/\r?\n/)
	let title = ''

	// Use a leading level-1 heading as the title, stripping it from the body.
	const firstIdx = bodyLines.findIndex((l) => l.trim() !== '')
	if (firstIdx !== -1) {
		const m = bodyLines[firstIdx].match(/^#\s+(.+)/)
		if (m) {
			title = m[1].trim()
			bodyLines = bodyLines.slice(0, firstIdx).concat(bodyLines.slice(firstIdx + 1))
		}
	}
	if (!title) title = fallbackTitle

	const { content, content_plain } = buildRichFromLines(bodyLines)

	return {
		title: title.slice(0, MAX_TITLE_LEN),
		content,
		content_plain,
		note_type: 'rich',
		list_id: listId,
	}
}
