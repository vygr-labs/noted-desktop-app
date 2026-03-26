import { Node } from '@tiptap/core'

export const InlineCheckbox = Node.create({
	name: 'inlineCheckbox',
	group: 'inline',
	inline: true,
	atom: true,

	addAttributes() {
		return {
			checked: { default: false },
		}
	},

	parseHTML() {
		return [
			{
				tag: 'input[data-inline-checkbox]',
				getAttrs(dom) {
					return { checked: (dom as HTMLInputElement).checked }
				},
			},
		]
	},

	renderHTML({ node }) {
		return [
			'input',
			{
				type: 'checkbox',
				'data-inline-checkbox': '',
				...(node.attrs.checked ? { checked: 'checked' } : {}),
			},
		]
	},

	addNodeView() {
		return ({ node, editor, getPos }) => {
			let currentChecked = !!node.attrs.checked

			const input = document.createElement('input')
			input.type = 'checkbox'
			input.checked = currentChecked
			input.setAttribute('data-inline-checkbox', '')
			input.style.cursor = 'pointer'
			input.style.margin = '0 2px'
			input.style.accentColor = 'var(--colors-indigo-9)'

			input.addEventListener('mousedown', (e) => {
				e.stopPropagation()
			})

			input.addEventListener('change', () => {
				if (typeof getPos === 'function') {
					currentChecked = input.checked
					editor.view.dispatch(
						editor.view.state.tr.setNodeMarkup(getPos(), undefined, {
							checked: currentChecked,
						})
					)
				}
			})

			return {
				dom: input,
				update(updatedNode) {
					if (updatedNode.type.name !== 'inlineCheckbox') return false
					currentChecked = !!updatedNode.attrs.checked
					input.checked = currentChecked
					return true
				},
				ignoreMutation() {
					return true
				},
			}
		}
	},
})
