// ─── Export operations ────────────────────────────────────

import { BrowserWindow, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import archiver from 'archiver'
import db from '../database/db.js'
import { tiptapToHtml, wrapHtmlDocument, wrapWordDocument } from './tiptap-to-html.js'
import { tiptapToMarkdown } from './tiptap-to-markdown.js'

interface NoteRow {
	id: string
	title: string
	content: string | null
	content_plain: string | null
	note_type: string
	list_id: string | null
	is_daily: number
	daily_date: string | null
	is_pinned: number
	is_trashed: number
	spellcheck: number
	created_at: string
	updated_at: string
}

function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim() || 'Untitled'
}

// ─── PDF generation via hidden BrowserWindow ─────────────

async function generatePdf(html: string, filePath: string): Promise<void> {
	const tmpFile = path.join(os.tmpdir(), `noted-export-${Date.now()}.html`)
	fs.writeFileSync(tmpFile, html, 'utf-8')

	const win = new BrowserWindow({ show: false, width: 800, height: 1100 })
	await win.loadFile(tmpFile)

	const pdfBuffer = await win.webContents.printToPDF({
		printBackground: true,
		pageSize: 'A4',
		margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
	})

	fs.writeFileSync(filePath, pdfBuffer)
	win.close()
	try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
}

// ─── Single note export ──────────────────────────────────

const NOTE_FORMATS: Record<string, { name: string; ext: string }> = {
	pdf: { name: 'PDF Document', ext: 'pdf' },
	doc: { name: 'Word Document', ext: 'doc' },
	html: { name: 'HTML File', ext: 'html' },
	md: { name: 'Markdown', ext: 'md' },
	txt: { name: 'Plain Text', ext: 'txt' },
}

const BULK_FORMATS: Record<string, { name: string; ext: string }> = {
	json: { name: 'JSON File', ext: 'json' },
	sql: { name: 'SQL File', ext: 'sql' },
	zip: { name: 'ZIP Archive (Markdown)', ext: 'zip' },
}

export async function exportNote(noteId: string, format: string): Promise<boolean> {
	const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as NoteRow | undefined
	if (!note) return false

	const fmt = NOTE_FORMATS[format]
	if (!fmt) return false

	const result = await dialog.showSaveDialog({
		defaultPath: `${sanitizeFilename(note.title)}.${fmt.ext}`,
		filters: [{ name: fmt.name, extensions: [fmt.ext] }],
	})

	if (result.canceled || !result.filePath) return false

	const filePath = result.filePath
	const ext = format
	const bodyHtml = note.note_type === 'rich' ? tiptapToHtml(note.content) : `<p>${escapeForHtml(note.content_plain || '')}</p>`

	switch (ext) {
		case 'txt':
			fs.writeFileSync(filePath, note.content_plain || note.title, 'utf-8')
			break
		case 'html':
			fs.writeFileSync(filePath, wrapHtmlDocument(note.title, bodyHtml), 'utf-8')
			break
		case 'md': {
			const md = note.note_type === 'rich'
				? `# ${note.title}\n\n${tiptapToMarkdown(note.content)}`
				: `# ${note.title}\n\n${note.content_plain || ''}\n`
			fs.writeFileSync(filePath, md, 'utf-8')
			break
		}
		case 'doc':
			fs.writeFileSync(filePath, wrapWordDocument(note.title, bodyHtml), 'utf-8')
			break
		case 'pdf':
			await generatePdf(wrapHtmlDocument(note.title, bodyHtml), filePath)
			break
		default:
			fs.writeFileSync(filePath, note.content_plain || note.title, 'utf-8')
	}

	return true
}

// ─── Bulk export (all notes) ─────────────────────────────

export async function exportAllNotes(format: string): Promise<boolean> {
	const fmt = BULK_FORMATS[format]
	if (!fmt) return false

	const result = await dialog.showSaveDialog({
		defaultPath: `noted-export.${fmt.ext}`,
		filters: [{ name: fmt.name, extensions: [fmt.ext] }],
	})

	if (result.canceled || !result.filePath) return false

	const filePath = result.filePath
	const ext = format

	switch (ext) {
		case 'json':
			fs.writeFileSync(filePath, buildJsonExport(), 'utf-8')
			break
		case 'sql':
			fs.writeFileSync(filePath, buildSqlExport(), 'utf-8')
			break
		case 'zip':
			await buildZipExport(filePath)
			break
		default:
			fs.writeFileSync(filePath, buildJsonExport(), 'utf-8')
	}

	return true
}

// ─── JSON export ─────────────────────────────────────────

function buildJsonExport(): string {
	const data = {
		exported_at: new Date().toISOString(),
		app: 'noted',
		notes: db.prepare('SELECT * FROM notes WHERE is_trashed = 0').all(),
		lists: db.prepare('SELECT * FROM lists').all(),
		tags: db.prepare('SELECT * FROM tags').all(),
		note_tags: db.prepare('SELECT * FROM note_tags').all(),
		todos: db.prepare('SELECT * FROM todos').all(),
		todo_lists: db.prepare('SELECT * FROM todo_lists').all(),
		settings: db.prepare('SELECT * FROM settings').all(),
	}
	return JSON.stringify(data, null, 2)
}

// ─── SQL export ──────────────────────────────────────────

function buildSqlExport(): string {
	const tables = ['lists', 'notes', 'tags', 'note_tags', 'todos', 'todo_lists', 'settings']
	let sql = '-- Noted Database Export\n'
	sql += `-- Generated: ${new Date().toISOString()}\n\n`

	for (const table of tables) {
		const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
		if (rows.length === 0) continue

		sql += `-- Table: ${table}\n`
		for (const row of rows) {
			const cols = Object.keys(row)
			const vals = Object.values(row).map((v) =>
				v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
			)
			sql += `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`
		}
		sql += '\n'
	}

	return sql
}

// ─── ZIP export (all notes as markdown) ──────────────────

async function buildZipExport(filePath: string): Promise<void> {
	const notes = db.prepare('SELECT * FROM notes WHERE is_trashed = 0').all() as NoteRow[]

	return new Promise<void>((resolve, reject) => {
		const output = fs.createWriteStream(filePath)
		const archive = archiver('zip', { zlib: { level: 9 } })

		output.on('close', resolve)
		archive.on('error', reject)
		archive.pipe(output)

		for (const note of notes) {
			const filename = `${sanitizeFilename(note.title)}.md`
			const md = note.note_type === 'rich'
				? `# ${note.title}\n\n${tiptapToMarkdown(note.content)}`
				: `# ${note.title}\n\n${note.content_plain || ''}\n`
			archive.append(md, { name: filename })
		}

		archive.finalize()
	})
}

// ─── Helpers ─────────────────────────────────────────────

function escapeForHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>')
}
