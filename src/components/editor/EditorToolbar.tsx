import { css } from '../../../styled-system/css'
import { getEditorInstance, cleanEditorContent, alignEditorContent, isInTable } from './TipTapEditor'
import { Show } from 'solid-js'
import {
	BoldIcon,
	ItalicIcon,
	UnderlineIcon,
	StrikethroughIcon,
	HighlighterIcon,
	Heading1Icon,
	Heading2Icon,
	Heading3Icon,
	ListIcon,
	ListOrderedIcon,
	ListChecksIcon,
	CodeIcon,
	QuoteIcon,
	MinusIcon,
	SparklesIcon,
	TableIcon,
	AlignLeftIcon,
	Trash2Icon,
	EyeOffIcon,
} from 'lucide-solid'

export type ToolbarPosition = 'top' | 'right' | 'bottom' | 'left'

const toolBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '8',
	height: '8',
	borderRadius: 'lg',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	flexShrink: 0,
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	'&[data-active="true"]': {
		bg: 'indigo.a3',
		color: 'indigo.11',
	},
})

const iconSize = css({ width: '4', height: '4' })

const tableCtxBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	height: '7',
	padding: '0 8px',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	flexShrink: 0,
	fontSize: '11px',
	fontWeight: 'medium',
	fontFamily: 'inherit',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

export function EditorToolbar(props: {
	scrolled?: boolean
	position?: ToolbarPosition
}) {
	function cmd(action: () => void) {
		return (e: MouseEvent) => {
			e.preventDefault()
			action()
		}
	}

	const e = () => getEditorInstance()

	const isVertical = () =>
		props.position === 'left' || props.position === 'right'

	const dividerStyle = () => {
		if (isVertical()) {
			return {
				width: '20px',
				height: '1px',
				background: 'var(--colors-gray-a3)',
				margin: '4px 0',
				'flex-shrink': '0',
			}
		}
		return {
			width: '1px',
			height: '20px',
			background: 'var(--colors-gray-a3)',
			margin: '0 6px',
			'flex-shrink': '0',
		}
	}

	const toolbarContainerStyle = () => {
		const pos = props.position || 'top'
		const base: Record<string, string> = {
			display: 'flex',
			'align-items': 'center',
			gap: '2px',
			'flex-shrink': '0',
			'z-index': '2',
			background: 'var(--colors-bg-default)',
			transition: 'box-shadow 0.2s ease',
		}

		if (pos === 'top' || pos === 'bottom') {
			base['flex-direction'] = 'row'
			base['flex-wrap'] = 'wrap'
			base.padding = '8px 180px 8px 24px'
			if (pos === 'top') {
				base['border-bottom'] = '1px solid var(--colors-gray-a2)'
				base['box-shadow'] = props.scrolled
					? '0 2px 12px -3px rgba(0, 0, 0, 0.1)'
					: 'none'
			} else {
				base['border-top'] = '1px solid var(--colors-gray-a2)'
			}
		} else {
			base['flex-direction'] = 'column'
			base['overflow-y'] = 'auto'
			base.padding = '12px 8px'
			if (pos === 'left') {
				base['border-right'] = '1px solid var(--colors-gray-a2)'
			} else {
				base['border-left'] = '1px solid var(--colors-gray-a2)'
			}
		}

		return base
	}

	return (
		<div style={toolbarContainerStyle()}>
			<button
				class={toolBtn}
				onMouseDown={cmd(() => e()?.chain().focus().toggleBold().run())}
				title="Bold (Ctrl+B)"
			>
				<BoldIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() => e()?.chain().focus().toggleItalic().run())}
				title="Italic (Ctrl+I)"
			>
				<ItalicIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() => e()?.chain().focus().toggleUnderline().run())}
				title="Underline (Ctrl+U)"
			>
				<UnderlineIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() => e()?.chain().focus().toggleStrike().run())}
				title="Strikethrough (Ctrl+Shift+S)"
			>
				<StrikethroughIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() => e()?.chain().focus().toggleHighlight().run())}
				title="Highlight"
			>
				<HighlighterIcon class={iconSize} />
			</button>

			<div style={dividerStyle()} />

			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleHeading({ level: 1 }).run()
				)}
				title="Heading 1"
			>
				<Heading1Icon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleHeading({ level: 2 }).run()
				)}
				title="Heading 2"
			>
				<Heading2Icon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleHeading({ level: 3 }).run()
				)}
				title="Heading 3"
			>
				<Heading3Icon class={iconSize} />
			</button>

			<div style={dividerStyle()} />

			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleBulletList().run()
				)}
				title="Bullet List"
			>
				<ListIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleOrderedList().run()
				)}
				title="Ordered List"
			>
				<ListOrderedIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleTaskList().run()
				)}
				title="Task List"
			>
				<ListChecksIcon class={iconSize} />
			</button>

			<div style={dividerStyle()} />

			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleCodeBlock().run()
				)}
				title="Code Block (Ctrl+Alt+C)"
			>
				<CodeIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleBlockquote().run()
				)}
				title="Blockquote (Ctrl+Shift+B)"
			>
				<QuoteIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().toggleDetailsBlock().run()
				)}
				title="Toggle Hidden Section"
			>
				<EyeOffIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().setHorizontalRule().run()
				)}
				title="Horizontal Rule"
			>
				<MinusIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() =>
					e()?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
				)}
				title="Insert Table"
			>
				<TableIcon class={iconSize} />
			</button>

			<Show when={isInTable()}>
				<button
					class={tableCtxBtn}
					onMouseDown={cmd(() => e()?.chain().focus().addRowAfter().run())}
					title="Add Row Below"
				>
					+Row
				</button>
				<button
					class={tableCtxBtn}
					onMouseDown={cmd(() => e()?.chain().focus().deleteRow().run())}
					title="Delete Row"
				>
					−Row
				</button>
				<button
					class={tableCtxBtn}
					onMouseDown={cmd(() => e()?.chain().focus().addColumnAfter().run())}
					title="Add Column Right"
				>
					+Col
				</button>
				<button
					class={tableCtxBtn}
					onMouseDown={cmd(() => e()?.chain().focus().deleteColumn().run())}
					title="Delete Column"
				>
					−Col
				</button>
				<button
					class={toolBtn}
					onMouseDown={cmd(() => e()?.chain().focus().deleteTable().run())}
					title="Delete Table"
				>
					<Trash2Icon class={iconSize} />
				</button>
			</Show>

			<div style={dividerStyle()} />

			<button
				class={toolBtn}
				onMouseDown={cmd(() => alignEditorContent())}
				title="Align (remove leading whitespace)"
			>
				<AlignLeftIcon class={iconSize} />
			</button>
			<button
				class={toolBtn}
				onMouseDown={cmd(() => cleanEditorContent())}
				title="Clean & Format (fix lists, trim whitespace)"
			>
				<SparklesIcon class={iconSize} />
			</button>
		</div>
	)
}
