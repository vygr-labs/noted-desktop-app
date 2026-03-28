import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'

/**
 * Seeds a Yjs document with TipTap JSON content.
 * Used to push note content to the sync server for notes
 * that aren't currently open in the editor (e.g. when sharing a list).
 */
export function seedYjsWithContent(ydoc: Y.Doc, jsonContent: string): boolean {
	const fragment = ydoc.getXmlFragment('default')
	if (fragment.length > 0) return false // Already has content

	let parsed: Record<string, unknown> | string
	try {
		parsed = JSON.parse(jsonContent)
	} catch {
		return false
	}

	const extensions = [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			history: false,
		}),
		TaskList,
		TaskItem.configure({ nested: true }),
		Underline,
		Highlight.configure({ multicolor: false }),
		Collaboration.configure({ document: ydoc }),
	]

	const tempEditor = new Editor({ extensions })
	tempEditor.commands.setContent(parsed)
	tempEditor.destroy()
	return true
}
