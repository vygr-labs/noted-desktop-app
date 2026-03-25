#!/usr/bin/env node

// ─── Noted CLI ───────────────────────────────────────────
// Standalone CLI tool for creating and managing notes in the
// Noted app. Works on Windows, macOS, and Linux.

import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

// ─── Database path resolution (cross-platform) ──────────

function getDbPath(): string {
	const platform = process.platform
	let appData: string

	if (platform === 'win32') {
		appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
	} else if (platform === 'darwin') {
		appData = path.join(os.homedir(), 'Library', 'Application Support')
	} else {
		appData = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
	}

	return path.join(appData, 'noted', 'databases', 'app.sqlite')
}

// ─── Database setup ──────────────────────────────────────

function openDb(): Database.Database {
	const dbPath = getDbPath()
	const dbDir = path.dirname(dbPath)

	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true })
	}

	const db = new Database(dbPath)
	db.pragma('journal_mode = WAL')
	db.pragma('foreign_keys = ON')

	ensureSchema(db)
	return db
}

function getSchemaVersion(db: Database.Database): number {
	const row = db
		.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`)
		.get() as { name: string } | undefined
	if (!row) return 0
	const ver = db
		.prepare('SELECT MAX(version) as v FROM schema_version')
		.get() as { v: number | null } | undefined
	return ver?.v ?? 0
}

function ensureSchema(db: Database.Database): void {
	const version = getSchemaVersion(db)

	if (version < 1) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS schema_version (
				version INTEGER PRIMARY KEY,
				applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS lists (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				icon TEXT DEFAULT 'folder',
				color TEXT DEFAULT 'gray',
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS notes (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL DEFAULT 'Untitled',
				content TEXT,
				content_plain TEXT,
				note_type TEXT DEFAULT 'rich' CHECK(note_type IN ('rich', 'plain')),
				list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
				is_daily INTEGER DEFAULT 0,
				daily_date TEXT,
				is_pinned INTEGER DEFAULT 0,
				is_trashed INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS tags (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				color TEXT DEFAULT 'gray',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS note_tags (
				note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
				tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
				PRIMARY KEY (note_id, tag_id)
			);
			CREATE TABLE IF NOT EXISTS todos (
				id TEXT PRIMARY KEY,
				note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
				text TEXT NOT NULL,
				is_completed INTEGER DEFAULT 0,
				due_date TEXT,
				source_daily_date TEXT,
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT
			);
			CREATE INDEX IF NOT EXISTS idx_notes_list ON notes(list_id);
			CREATE INDEX IF NOT EXISTS idx_notes_daily ON notes(is_daily, daily_date);
			CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
			CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
			CREATE INDEX IF NOT EXISTS idx_todos_note ON todos(note_id);
			CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_date);
			CREATE INDEX IF NOT EXISTS idx_todos_daily ON todos(source_daily_date);
		`)
		db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(1)
	}

	if (version < 2) {
		db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
				note_id UNINDEXED, title, content_plain
			);
		`)
		const existingNotes = db.prepare('SELECT id, title, content_plain FROM notes').all() as {
			id: string; title: string; content_plain: string | null
		}[]
		const insertFts = db.prepare('INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)')
		for (const note of existingNotes) {
			insertFts.run(note.id, note.title, note.content_plain || '')
		}
		db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(2)
	}

	if (version < 3) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS todo_lists (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				color TEXT DEFAULT 'gray',
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`)
		// Check if column exists before adding
		const cols = db.prepare("PRAGMA table_info(todos)").all() as { name: string }[]
		if (!cols.some(c => c.name === 'todo_list_id')) {
			db.exec(`ALTER TABLE todos ADD COLUMN todo_list_id TEXT REFERENCES todo_lists(id) ON DELETE SET NULL;`)
			db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_list ON todos(todo_list_id);`)
		}
		db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(3)
	}

	if (version < 4) {
		const cols = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]
		if (!cols.some(c => c.name === 'spellcheck')) {
			db.exec(`ALTER TABLE notes ADD COLUMN spellcheck INTEGER DEFAULT 1;`)
		}
		db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(4)
	}
}

// ─── Note interfaces ─────────────────────────────────────

interface Note {
	id: string
	title: string
	content: string | null
	content_plain: string | null
	note_type: string
	list_id: string | null
	is_pinned: number
	is_trashed: number
	created_at: string
	updated_at: string
}

// ─── Argument parsing ────────────────────────────────────

function parseArgs(argv: string[]): { command: string; args: string[]; flags: Record<string, string | true> } {
	const raw = argv.slice(2)
	const command = raw[0] || 'help'
	const args: string[] = []
	const flags: Record<string, string | true> = {}

	let i = 1
	while (i < raw.length) {
		const arg = raw[i]
		if (arg.startsWith('--')) {
			const key = arg.slice(2)
			const next = raw[i + 1]
			if (next && !next.startsWith('--')) {
				flags[key] = next
				i += 2
			} else {
				flags[key] = true
				i++
			}
		} else {
			args.push(arg)
			i++
		}
	}

	return { command, args, flags }
}

// ─── Read stdin (for piped content) ──────────────────────

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		if (process.stdin.isTTY) {
			resolve('')
			return
		}
		let data = ''
		process.stdin.setEncoding('utf-8')
		process.stdin.on('data', (chunk) => { data += chunk })
		process.stdin.on('end', () => resolve(data))
	})
}

// ─── Commands ────────────────────────────────────────────

function cmdCreate(db: Database.Database, args: string[], flags: Record<string, string | true>, stdinContent: string): void {
	const title = (flags.title as string) || args[0] || 'Untitled'
	let content = (flags.content as string) || stdinContent || ''
	const noteType = (flags.type as string) === 'rich' ? 'rich' : 'plain'
	const listId = (flags.list as string) || null

	// For plain notes, store content in both fields
	const contentPlain = content || null
	const contentJson = noteType === 'plain' ? content : null

	const id = crypto.randomUUID()

	db.prepare(
		`INSERT INTO notes (id, title, content, content_plain, note_type, list_id)
		 VALUES (?, ?, ?, ?, ?, ?)`
	).run(id, title, contentJson, contentPlain, noteType, listId)

	db.prepare(
		'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
	).run(id, title, contentPlain || '')

	const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note
	console.log(JSON.stringify({ created: true, id: note.id, title: note.title }, null, 2))
}

function cmdList(db: Database.Database, flags: Record<string, string | true>): void {
	const limit = parseInt(flags.limit as string) || 50
	const notes = db
		.prepare('SELECT id, title, note_type, is_pinned, created_at, updated_at FROM notes WHERE is_trashed = 0 ORDER BY updated_at DESC LIMIT ?')
		.all(limit) as Pick<Note, 'id' | 'title' | 'note_type' | 'is_pinned' | 'created_at' | 'updated_at'>[]

	if (notes.length === 0) {
		console.log('No notes found.')
		return
	}

	for (const note of notes) {
		const pin = note.is_pinned ? ' [pinned]' : ''
		console.log(`  ${note.id}  ${note.title}${pin}  (${note.updated_at})`)
	}
	console.log(`\n${notes.length} note(s)`)
}

function cmdGet(db: Database.Database, args: string[], flags: Record<string, string | true>): void {
	const id = args[0]
	if (!id) {
		console.error('Usage: noted-cli get <note-id>')
		process.exit(1)
	}

	const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
	if (!note) {
		console.error(`Note not found: ${id}`)
		process.exit(1)
	}

	if (flags.json) {
		console.log(JSON.stringify(note, null, 2))
	} else {
		console.log(`Title: ${note.title}`)
		console.log(`Type:  ${note.note_type}`)
		console.log(`Date:  ${note.created_at}`)
		console.log(`---`)
		console.log(note.content_plain || '(empty)')
	}
}

function cmdSearch(db: Database.Database, args: string[], flags: Record<string, string | true>): void {
	const query = args.join(' ') || (flags.query as string)
	if (!query) {
		console.error('Usage: noted-cli search <query>')
		process.exit(1)
	}

	const ftsQuery = query
		.trim()
		.split(/\s+/)
		.map((word) => `"${word}"*`)
		.join(' ')

	const limit = parseInt(flags.limit as string) || 20

	const results = db.prepare(`
		SELECT n.id, n.title, snippet(notes_fts, 2, '>>>', '<<<', '...', 40) as snippet
		FROM notes_fts
		JOIN notes n ON n.id = notes_fts.note_id
		WHERE notes_fts MATCH ? AND n.is_trashed = 0
		ORDER BY rank
		LIMIT ?
	`).all(ftsQuery, limit) as { id: string; title: string; snippet: string }[]

	if (results.length === 0) {
		console.log('No results found.')
		return
	}

	for (const r of results) {
		console.log(`  ${r.id}  ${r.title}`)
		if (r.snippet) console.log(`    ${r.snippet}`)
	}
	console.log(`\n${results.length} result(s)`)
}

function cmdDelete(db: Database.Database, args: string[]): void {
	const id = args[0]
	if (!id) {
		console.error('Usage: noted-cli delete <note-id>')
		process.exit(1)
	}

	const note = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(id) as Note | undefined
	if (!note) {
		console.error(`Note not found: ${id}`)
		process.exit(1)
	}

	db.prepare('UPDATE notes SET is_trashed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)
	db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id)
	console.log(`Trashed: ${note.title}`)
}

function cmdLists(db: Database.Database): void {
	const lists = db.prepare('SELECT id, name, color FROM lists ORDER BY sort_order').all() as {
		id: string; name: string; color: string
	}[]

	if (lists.length === 0) {
		console.log('No lists found.')
		return
	}

	for (const list of lists) {
		console.log(`  ${list.id}  ${list.name}`)
	}
}

function cmdTags(db: Database.Database): void {
	const tags = db.prepare('SELECT id, name, color FROM tags ORDER BY name').all() as {
		id: string; name: string; color: string
	}[]

	if (tags.length === 0) {
		console.log('No tags found.')
		return
	}

	for (const tag of tags) {
		console.log(`  ${tag.id}  ${tag.name}`)
	}
}

function cmdHelp(): void {
	console.log(`
noted-cli — Command-line interface for the Noted app

USAGE
  noted-cli <command> [options]

COMMANDS
  create    Create a new note
  list      List all notes
  get       Get a note by ID
  search    Search notes
  delete    Move a note to trash
  lists     Show all lists
  tags      Show all tags
  help      Show this help message

CREATE OPTIONS
  --title <text>      Note title (default: "Untitled")
  --content <text>    Note content
  --type <rich|plain> Note type (default: "plain")
  --list <list-id>    Add to a specific list
  (stdin)             Pipe content from stdin

LIST OPTIONS
  --limit <n>         Max notes to show (default: 50)

GET OPTIONS
  --json              Output full note as JSON

SEARCH OPTIONS
  --limit <n>         Max results (default: 20)

EXAMPLES
  noted-cli create --title "Meeting Notes" --content "Discuss Q4 roadmap"
  echo "Quick thought" | noted-cli create --title "Idea"
  cat document.md | noted-cli create --title "Imported Doc"
  noted-cli list
  noted-cli get abc123
  noted-cli search "roadmap"
  noted-cli delete abc123

DATABASE
  ${getDbPath()}
`.trim())
}

// ─── Main ────────────────────────────────────────────────

async function main() {
	const { command, args, flags } = parseArgs(process.argv)

	if (command === 'help' || flags.help) {
		cmdHelp()
		return
	}

	const stdinContent = await readStdin()
	const db = openDb()

	try {
		switch (command) {
			case 'create':
				cmdCreate(db, args, flags, stdinContent)
				break
			case 'list':
			case 'ls':
				cmdList(db, flags)
				break
			case 'get':
				cmdGet(db, args, flags)
				break
			case 'search':
			case 'find':
				cmdSearch(db, args, flags)
				break
			case 'delete':
			case 'rm':
				cmdDelete(db, args)
				break
			case 'lists':
				cmdLists(db)
				break
			case 'tags':
				cmdTags(db)
				break
			default:
				console.error(`Unknown command: ${command}`)
				console.error('Run "noted-cli help" for usage.')
				process.exit(1)
		}
	} finally {
		db.close()
	}
}

main().catch((err) => {
	console.error(err.message || err)
	process.exit(1)
})
