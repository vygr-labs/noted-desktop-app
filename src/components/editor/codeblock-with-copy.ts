import CodeBlock from '@tiptap/extension-code-block'
import { mergeAttributes } from '@tiptap/core'

const copyIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`

const checkIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

export const CodeBlockWithCopy = CodeBlock.extend({
	addNodeView() {
		return ({ node, HTMLAttributes }) => {
			const pre = document.createElement('pre')
			const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
			Object.entries(attrs).forEach(([key, value]) => {
				if (typeof value === 'string') {
					pre.setAttribute(key, value)
				}
			})

			const code = document.createElement('code')
			if (node.attrs.language) {
				code.className = `${this.options.languageClassPrefix}${node.attrs.language}`
			}

			const copyBtn = document.createElement('button')
			copyBtn.className = 'codeblock-copy-btn'
			copyBtn.title = 'Copy code'
			copyBtn.type = 'button'
			copyBtn.contentEditable = 'false'
			copyBtn.innerHTML = copyIconSvg

			copyBtn.addEventListener('mousedown', (e) => {
				e.preventDefault()
				e.stopPropagation()
			})

			copyBtn.addEventListener('click', (e) => {
				e.preventDefault()
				e.stopPropagation()
				const text = code.textContent || ''
				navigator.clipboard.writeText(text.trim())

				copyBtn.innerHTML = checkIconSvg
				copyBtn.style.color = 'var(--colors-green-9)'
				copyBtn.style.opacity = '1'
				setTimeout(() => {
					copyBtn.innerHTML = copyIconSvg
					copyBtn.style.color = ''
					copyBtn.style.opacity = ''
				}, 1500)
			})

			pre.appendChild(copyBtn)
			pre.appendChild(code)

			return {
				dom: pre,
				contentDOM: code,
				ignoreMutation(mutation: MutationRecord) {
					// Ignore all mutations inside the copy button so ProseMirror
					// doesn't re-render the NodeView when we swap the icon
					if (copyBtn.contains(mutation.target)) return true
					return false
				},
			}
		}
	},
})
