import fs from 'node:fs'
import path from 'node:path'
import { RESOURCES_PATH } from '../constants.js'

// ─── TipTap JSON → HTML converter ────────────────────────

interface TipTapNode {
	type: string
	content?: TipTapNode[]
	text?: string
	attrs?: Record<string, unknown>
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function renderMarks(
	text: string,
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
): string {
	if (!marks || marks.length === 0) return escapeHtml(text)

	let html = escapeHtml(text)
	for (const mark of marks) {
		switch (mark.type) {
			case 'bold':
				html = `<strong>${html}</strong>`
				break
			case 'italic':
				html = `<em>${html}</em>`
				break
			case 'underline':
				html = `<u>${html}</u>`
				break
			case 'strike':
				html = `<s>${html}</s>`
				break
			case 'highlight':
				html = `<mark>${html}</mark>`
				break
			case 'code':
				html = `<code>${html}</code>`
				break
			case 'link':
				html = `<a href="${escapeHtml(String(mark.attrs?.href || ''))}">${html}</a>`
				break
		}
	}
	return html
}

function renderNode(node: TipTapNode): string {
	if (node.type === 'text') {
		return renderMarks(node.text || '', node.marks)
	}

	const children = (node.content || []).map(renderNode).join('')

	switch (node.type) {
		case 'doc':
			return children
		case 'paragraph':
			return `<p>${children || '<br>'}</p>`
		case 'heading': {
			const level = node.attrs?.level || 1
			return `<h${level}>${children}</h${level}>`
		}
		case 'bulletList':
			return `<ul>${children}</ul>`
		case 'orderedList':
			return `<ol>${children}</ol>`
		case 'listItem':
			return `<li>${children}</li>`
		case 'taskList':
			return `<ul class="task-list">${children}</ul>`
		case 'taskItem': {
			const isChecked = !!node.attrs?.checked
			const cls = isChecked ? 'task-item checked-item' : 'task-item'
			const checkedAttr = isChecked ? ' checked' : ''
			return `<li class="${cls}"><input type="checkbox"${checkedAttr} disabled />${children}</li>`
		}
		case 'codeBlock':
			return `<pre><code>${children}</code></pre>`
		case 'blockquote':
			return `<blockquote>${children}</blockquote>`
		case 'detailsBlock': {
			const summary = escapeHtml(String(node.attrs?.summary || 'Hidden section'))
			return `<details><summary>${summary}</summary>${children}</details>`
		}
		case 'horizontalRule':
			return '<hr>'
		case 'hardBreak':
			return '<br>'
		case 'table':
			return `<table>${children}</table>`
		case 'tableRow':
			return `<tr>${children}</tr>`
		case 'tableHeader':
			return `<th>${children}</th>`
		case 'tableCell':
			return `<td>${children}</td>`
		default:
			return children
	}
}

export function tiptapToHtml(json: string | null): string {
	if (!json) return ''
	try {
		const doc = typeof json === 'string' ? JSON.parse(json) : json
		return renderNode(doc)
	} catch {
		return ''
	}
}

const CSS = `
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; }
h1 { font-size: 28px; margin-bottom: 8px; }
h2 { font-size: 22px; }
h3 { font-size: 18px; }
p { margin: 0 0 8px; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f5f5f5; font-weight: 600; }
pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
code { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; }
p code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
blockquote { border-left: 3px solid #ddd; margin: 8px 0; padding-left: 16px; color: #555; }
.task-list { list-style: none; padding-left: 0; }
.task-item { display: flex; align-items: baseline; gap: 8px; margin: 4px 0; }
.task-item input { margin: 0; }
hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
mark { background: #fff3b0; padding: 1px 4px; border-radius: 2px; }
ul, ol { margin: 4px 0; padding-left: 24px; }
li { margin: 2px 0; }
`.trim()

export function wrapHtmlDocument(title: string, bodyHtml: string): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`
}

export function wrapWordDocument(title: string, bodyHtml: string): string {
	return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:WordDocument></xml><![endif]-->
<style>${CSS}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`
}

// ─── Professional PDF export ─────────────────────────────

function formatExportDate(iso: string): string {
	try {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric', month: 'long', day: 'numeric',
		}).format(new Date(iso))
	} catch {
		return iso
	}
}

function loadFontAsBase64(filename: string): string {
	try {
		const fontPath = path.join(RESOURCES_PATH, 'fonts', filename)
		const buffer = fs.readFileSync(fontPath)
		return buffer.toString('base64')
	} catch {
		return ''
	}
}

function buildPdfCss(): string {
	const interBase64 = loadFontAsBase64('Inter-Variable.ttf')
	const jetbrainsBase64 = loadFontAsBase64('JetBrainsMono-Variable.ttf')

	const fontFaces = `
${interBase64 ? `@font-face {
  font-family: 'Inter';
  src: url(data:font/ttf;base64,${interBase64}) format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}` : ''}
${jetbrainsBase64 ? `@font-face {
  font-family: 'JetBrains Mono';
  src: url(data:font/ttf;base64,${jetbrainsBase64}) format('truetype');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}` : ''}
`

	return `
${fontFaces}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 680px;
  margin: 0 auto;
  color: #1c2024;
  line-height: 1.6;
  font-size: 15px;
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
}

/* ── Header ── */
.pdf-header {
  padding-bottom: 20px;
  margin-bottom: 28px;
  border-bottom: 1.5px solid #e8e8ec;
}
.pdf-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.025em;
  color: #1c2024;
  margin: 0 0 6px 0;
}
.pdf-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #80838d;
}

/* ── Headings ── */
h1 { font-size: 1.75rem; font-weight: 700; line-height: 1.3; letter-spacing: -0.025em; margin: 1.5em 0 0.5em; }
h2 { font-size: 1.35rem; font-weight: 650; line-height: 1.35; letter-spacing: -0.02em; margin: 1.4em 0 0.4em; }
h3 { font-size: 1.1rem; font-weight: 600; line-height: 1.45; letter-spacing: -0.01em; margin: 1.2em 0 0.3em; }

/* ── Text ── */
p { margin: 0 0 0.75em; line-height: 1.6; }
strong { font-weight: 650; }
a { color: #a41a00; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: #ffcbbc; }
u { text-underline-offset: 3px; text-decoration-color: rgba(28, 32, 36, 0.25); }
s { text-decoration-color: #b9bbc6; }
mark { background: #fff3b0; padding: 1px 4px; border-radius: 3px; }

/* ── Code ── */
code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.85em;
}
p code, li code {
  background: #f0f0f3;
  padding: 2px 6px;
  border-radius: 4px;
  color: #a41a00;
}
pre {
  background: #f9f9fb;
  border: 1px solid #e8e8ec;
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 1em 0;
  line-height: 1.55;
}
pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  color: #1c2024;
  font-size: 13px;
}

/* ── Blockquotes ── */
blockquote {
  border-left: 3px solid #ffcbbc;
  margin: 1.25em 0;
  padding: 0.5em 0 0.5em 1.25em;
  color: #60646c;
  font-style: italic;
}
blockquote p { margin-bottom: 0.4em; }
blockquote p:last-child { margin-bottom: 0; }

/* ── Tables ── */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  font-size: 14px;
  border: 1px solid #e0e1e6;
}
th {
  background: #f9f9fb;
  font-weight: 600;
  font-size: 13px;
  text-align: left;
  padding: 10px 14px;
  border: 1px solid #e0e1e6;
}
td {
  padding: 10px 14px;
  text-align: left;
  border: 1px solid #e8e8ec;
  vertical-align: top;
}
tr:nth-child(even) td { background: #fcfcfd; }

/* ── Lists ── */
ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
ul { list-style-type: disc; }
ol { list-style-type: decimal; }
li { margin: 3px 0; line-height: 1.6; }
li > p { margin: 0; }

/* ── Task Lists ── */
.task-list { list-style: none; padding-left: 0; margin: 0.5em 0; }
.task-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 5px 0;
  line-height: 1.6;
}
.task-item input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  border: 1.5px solid #b9bbc6;
  border-radius: 3px;
  flex-shrink: 0;
  position: relative;
  top: 2px;
  margin: 0;
}
.task-item input[type="checkbox"]:checked {
  background: #CE2100;
  border-color: #CE2100;
}
.task-item input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.checked-item > p,
.checked-item > div {
  text-decoration: line-through;
  color: #80838d;
}

/* ── Other ── */
hr { border: none; border-top: 1px solid #e8e8ec; margin: 2em 0; }
details {
  border: 1px solid #e8e8ec;
  border-radius: 6px;
  margin: 0.75em 0;
  overflow: hidden;
}
details summary {
  padding: 10px 14px;
  background: #f9f9fb;
  font-weight: 500;
  font-size: 14px;
  color: #60646c;
}
details > *:not(summary) { padding: 12px 16px; }

/* ── Footer ── */
.pdf-footer {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid #e8e8ec;
  font-size: 11px;
  color: #b9bbc6;
}
.pdf-footer .brand { font-weight: 600; color: #CE2100; letter-spacing: -0.02em; }
`.trim()
}

export interface PdfMeta {
	createdAt?: string
	updatedAt?: string
}

export function wrapPdfDocument(title: string, bodyHtml: string, meta?: PdfMeta): string {
	const pdfCss = buildPdfCss()
	const createdStr = meta?.createdAt ? formatExportDate(meta.createdAt) : ''
	const updatedStr = meta?.updatedAt ? formatExportDate(meta.updatedAt) : ''
	const exportDate = formatExportDate(new Date().toISOString())

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${pdfCss}</style>
</head>
<body>
<div class="pdf-header">
<h1>${escapeHtml(title)}</h1>
</div>
<div class="pdf-content">
${bodyHtml}
</div>
<div class="pdf-footer">
<span>Exported from <span class="brand">noted.</span></span>
</div>
</body>
</html>`
}
