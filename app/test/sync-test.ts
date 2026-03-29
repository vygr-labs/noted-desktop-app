/**
 * Sync Test Page
 *
 * Two TipTap editors side by side, syncing via y-prosemirror + HocusPocus.
 * This tests whether the sync works without editor glitches BEFORE
 * integrating into the main app.
 *
 * Usage:
 *   1. Start the HocusPocus server: cd server && npm start
 *   2. Run: cd app && npx vite app/test/sync-test.html --open
 */

import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror'

const DOC_NAME = 'sync-test-doc'
const DOC_SECRET = 'test-secret-123'
const SERVER_URL = 'ws://localhost:9090'

const USERS = [
	{ name: 'Alice', color: '#6366f1' },
	{ name: 'Bob', color: '#f59e0b' },
]

function createSyncEditor(
	element: HTMLElement,
	label: string,
	statusEl: HTMLElement,
	logEl: HTMLElement,
	userIndex: number,
) {
	const ydoc = new Y.Doc()
	const provider = new HocuspocusProvider({
		url: SERVER_URL,
		name: DOC_NAME,
		document: ydoc,
		token: DOC_SECRET,
		onConnect: () => {
			statusEl.textContent = 'Connected'
			statusEl.style.color = '#16a34a'
			log(logEl, 'Connected to server')
		},
		onDisconnect: () => {
			statusEl.textContent = 'Disconnected'
			statusEl.style.color = '#dc2626'
			log(logEl, 'Disconnected')
		},
		onSynced: ({ state }) => {
			if (state) {
				log(logEl, 'Initial sync complete')
			}
		},
		onAuthenticationFailed: ({ reason }) => {
			statusEl.textContent = 'Auth failed'
			statusEl.style.color = '#dc2626'
			log(logEl, `Auth failed: ${reason}`)
		},
	})

	// Set awareness user info for cursor display
	const user = USERS[userIndex]
	provider.awareness!.setLocalStateField('user', user)

	const fragment = ydoc.getXmlFragment('default')

	const editor = new Editor({
		element,
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
				codeBlock: true,
				undoRedo: false, // y-prosemirror handles undo
			}),
			TaskList,
			TaskItem.configure({ nested: true }),
			Highlight.configure({ multicolor: false }),
			Extension.create({
				name: 'ySync',
				addProseMirrorPlugins: () => [
					ySyncPlugin(fragment),
					yCursorPlugin(provider.awareness!),
					yUndoPlugin(),
				],
			}),
		],
		editorProps: {
			attributes: {
				style: 'outline: none; min-height: 300px; padding: 16px; font-family: Inter, system-ui, sans-serif; font-size: 15px; line-height: 1.6;',
			},
		},
		onUpdate: () => {
			log(logEl, `Content updated (${editor.getText().length} chars)`)
		},
	})

	log(logEl, `${label} editor created`)
	return { editor, provider, ydoc }
}

function log(el: HTMLElement, msg: string) {
	const time = new Date().toLocaleTimeString('en-US', { hour12: false }) +
		'.' + String(new Date().getMilliseconds()).padStart(3, '0')
	const line = document.createElement('div')
	line.textContent = `[${time}] ${msg}`
	el.appendChild(line)
	el.scrollTop = el.scrollHeight
}

// ─── Init ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
	const editor1El = document.getElementById('editor1')!
	const editor2El = document.getElementById('editor2')!
	const status1El = document.getElementById('status1')!
	const status2El = document.getElementById('status2')!
	const log1El = document.getElementById('log1')!
	const log2El = document.getElementById('log2')!

	createSyncEditor(editor1El, 'Editor A', status1El, log1El, 0)
	createSyncEditor(editor2El, 'Editor B', status2El, log2El, 1)
})
