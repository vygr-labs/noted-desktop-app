import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { ySyncPlugin } from 'y-prosemirror'
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
			undoRedo: false,
		}),
		TaskList,
		TaskItem.configure({ nested: true }),
		Highlight.configure({ multicolor: false }),
		Extension.create({
			name: 'ySync',
			addProseMirrorPlugins: () => [ySyncPlugin(fragment)],
		}),
	]

	const tempEditor = new Editor({ extensions })
	tempEditor.commands.setContent(parsed)
	tempEditor.destroy()
	return true
}
