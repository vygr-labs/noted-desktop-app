import { Node, mergeAttributes } from '@tiptap/core'

const chevronSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`

export const DetailsBlock = Node.create({
	name: 'detailsBlock',
	group: 'block',
	content: 'block+',
	defining: true,

	addAttributes() {
		return {
			summary: { default: 'Hidden section' },
			open: { default: true },
		}
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-type="details-block"]',
				getAttrs(dom) {
					const el = dom as HTMLElement
					return {
						summary: el.getAttribute('data-summary') || 'Hidden section',
						open: el.getAttribute('data-open') !== 'false',
					}
				},
			},
		]
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-type': 'details-block',
				'data-summary': node.attrs.summary,
				'data-open': node.attrs.open ? 'true' : 'false',
			}),
			0,
		]
	},

	addNodeView() {
		return ({ node, editor, getPos }) => {
			// Outer wrapper
			const dom = document.createElement('div')
			dom.classList.add('details-block')
			dom.setAttribute('data-open', node.attrs.open ? 'true' : 'false')

			// Header bar
			const header = document.createElement('div')
			header.classList.add('details-header')
			header.contentEditable = 'false'

			const chevron = document.createElement('span')
			chevron.classList.add('details-chevron')
			chevron.innerHTML = chevronSvg

			const summaryEl = document.createElement('span')
			summaryEl.classList.add('details-summary-text')
			summaryEl.textContent = node.attrs.summary

			// Double-click summary text to edit
			summaryEl.addEventListener('dblclick', (e) => {
				e.stopPropagation()
				const input = document.createElement('input')
				input.className = 'details-summary-input'
				input.value = node.attrs.summary
				input.addEventListener('keydown', (ke) => {
					ke.stopPropagation()
					if (ke.key === 'Enter') input.blur()
					if (ke.key === 'Escape') {
						input.value = node.attrs.summary
						input.blur()
					}
				})
				input.addEventListener('blur', () => {
					const newSummary = input.value.trim() || 'Hidden section'
					if (typeof getPos === 'function') {
						editor.view.dispatch(
							editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
								...node.attrs,
								summary: newSummary,
							})
						)
					}
				})
				summaryEl.replaceWith(input)
				input.focus()
				input.select()
			})

			// Click chevron to toggle
			chevron.addEventListener('click', (e) => {
				e.preventDefault()
				e.stopPropagation()
				if (typeof getPos === 'function') {
					editor.view.dispatch(
						editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
							...node.attrs,
							open: !node.attrs.open,
						})
					)
				}
			})

			// Click empty part of header to toggle too
			header.addEventListener('click', (e) => {
				if (e.target === header) {
					e.preventDefault()
					if (typeof getPos === 'function') {
						editor.view.dispatch(
							editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
								...node.attrs,
								open: !node.attrs.open,
							})
						)
					}
				}
			})

			header.appendChild(chevron)
			header.appendChild(summaryEl)

			// Content area
			const contentDOM = document.createElement('div')
			contentDOM.classList.add('details-content')

			dom.appendChild(header)
			dom.appendChild(contentDOM)

			return {
				dom,
				contentDOM,
				update(updatedNode) {
					if (updatedNode.type.name !== 'detailsBlock') return false
					node = updatedNode
					dom.setAttribute('data-open', updatedNode.attrs.open ? 'true' : 'false')
					// Only update text if not currently editing
					const existing = header.querySelector('.details-summary-text')
					if (existing) {
						existing.textContent = updatedNode.attrs.summary
					}
					return true
				},
				ignoreMutation(mutation: MutationRecord) {
					if (header.contains(mutation.target)) return true
					return false
				},
			}
		}
	},

	addCommands() {
		return {
			setDetailsBlock:
				(attrs) =>
				({ commands }) => {
					return commands.wrapIn(this.name, attrs)
				},
			unsetDetailsBlock:
				() =>
				({ commands }) => {
					return commands.lift(this.name)
				},
			toggleDetailsBlock:
				(attrs) =>
				({ commands }) => {
					return commands.toggleWrap(this.name, attrs)
				},
		}
	},
})
