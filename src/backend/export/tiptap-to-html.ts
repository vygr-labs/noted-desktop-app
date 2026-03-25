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
			const checked = node.attrs?.checked ? ' checked' : ''
			return `<li class="task-item"><input type="checkbox"${checked} disabled />${children}</li>`
		}
		case 'codeBlock':
			return `<pre><code>${children}</code></pre>`
		case 'blockquote':
			return `<blockquote>${children}</blockquote>`
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
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>${CSS}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`
}
