import Database from 'better-sqlite3'
import path from 'node:path'
import crypto from 'node:crypto'
import { DB_PATH } from '../constants.js'

const dbFile = path.join(DB_PATH, 'app.sqlite')
const db = new Database(dbFile)

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function getSchemaVersion(): number {
	const row = db
		.prepare(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`
		)
		.get() as { name: string } | undefined
	if (!row) return 0
	const ver = db
		.prepare('SELECT MAX(version) as v FROM schema_version')
		.get() as { v: number | null } | undefined
	return ver?.v ?? 0
}

function setSchemaVersion(version: number) {
	db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version)
}

export function generateId(): string {
	return crypto.randomUUID()
}

function migrateOldNotesTable() {
	// Must run BEFORE migration 1, because the old `notes` table (integer PK)
	// blocks `CREATE TABLE IF NOT EXISTS notes (... list_id ...)` from executing,
	// then `CREATE INDEX ON notes(list_id)` fails on the old schema.
	const oldNotes = db
		.prepare(
			`SELECT sql FROM sqlite_master WHERE type='table' AND name='notes'`
		)
		.get() as { sql: string } | undefined
	if (
		oldNotes &&
		oldNotes.sql.includes('INTEGER PRIMARY KEY AUTOINCREMENT')
	) {
		const rows = db.prepare('SELECT * FROM notes').all() as {
			id: number
			title: string
			content: string | null
			created_at: string
			updated_at: string
		}[]
		db.exec('DROP TABLE notes')
		db.exec(`
			CREATE TABLE notes (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL DEFAULT 'Untitled',
				content TEXT,
				content_plain TEXT,
				note_type TEXT DEFAULT 'rich' CHECK(note_type IN ('rich', 'plain')),
				list_id TEXT,
				is_daily INTEGER DEFAULT 0,
				daily_date TEXT,
				is_pinned INTEGER DEFAULT 0,
				is_trashed INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`)
		const insertStmt = db.prepare(
			`INSERT INTO notes (id, title, content, content_plain, note_type, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 'plain', ?, ?)`
		)
		for (const row of rows) {
			insertStmt.run(
				generateId(),
				row.title,
				row.content,
				row.content,
				row.created_at,
				row.updated_at
			)
		}
	}
}

function runMigrations() {
	// Migrate legacy table before anything else
	migrateOldNotesTable()

	const currentVersion = getSchemaVersion()

	if (currentVersion < 1) {
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
		setSchemaVersion(1)
	}

	if (currentVersion < 2) {
		db.exec(`
			CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
				note_id UNINDEXED,
				title,
				content_plain
			);
		`)

		// Populate FTS with any existing notes
		const existingNotes = db
			.prepare('SELECT id, title, content_plain FROM notes')
			.all() as { id: string; title: string; content_plain: string | null }[]
		const insertFts = db.prepare(
			'INSERT INTO notes_fts (note_id, title, content_plain) VALUES (?, ?, ?)'
		)
		for (const note of existingNotes) {
			insertFts.run(note.id, note.title, note.content_plain || '')
		}

		setSchemaVersion(2)
	}

	if (currentVersion < 3) {
		db.exec(`
			CREATE TABLE IF NOT EXISTS todo_lists (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				color TEXT DEFAULT 'gray',
				sort_order INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			ALTER TABLE todos ADD COLUMN todo_list_id TEXT REFERENCES todo_lists(id) ON DELETE SET NULL;
			CREATE INDEX IF NOT EXISTS idx_todos_list ON todos(todo_list_id);
		`)
		setSchemaVersion(3)
	}

	if (currentVersion < 4) {
		db.exec(`
			ALTER TABLE notes ADD COLUMN spellcheck INTEGER DEFAULT 1;
		`)
		setSchemaVersion(4)
	}

	if (currentVersion < 5) {
		db.exec(`
			ALTER TABLE notes ADD COLUMN sync_id TEXT;
			ALTER TABLE notes ADD COLUMN is_shared INTEGER DEFAULT 0;
		`)
		setSchemaVersion(5)
	}

	if (currentVersion < 6) {
		const cols = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]
		if (!cols.some(c => c.name === 'is_locked')) {
			db.exec(`ALTER TABLE notes ADD COLUMN is_locked INTEGER DEFAULT 0;`)
		}
		setSchemaVersion(6)
	}

	if (currentVersion < 7) {
		const cols = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]
		if (!cols.some(c => c.name === 'sync_secret')) {
			db.exec(`ALTER TABLE notes ADD COLUMN sync_secret TEXT;`)
		}
		setSchemaVersion(7)
	}

	if (currentVersion < 8) {
		const listCols = db.prepare("PRAGMA table_info(lists)").all() as { name: string }[]
		if (!listCols.some(c => c.name === 'sync_id')) {
			db.exec(`ALTER TABLE lists ADD COLUMN sync_id TEXT;`)
		}
		if (!listCols.some(c => c.name === 'sync_secret')) {
			db.exec(`ALTER TABLE lists ADD COLUMN sync_secret TEXT;`)
		}
		if (!listCols.some(c => c.name === 'is_shared')) {
			db.exec(`ALTER TABLE lists ADD COLUMN is_shared INTEGER DEFAULT 0;`)
		}
		db.exec(`
			CREATE TABLE IF NOT EXISTS yjs_state (
				doc_name TEXT PRIMARY KEY,
				state BLOB NOT NULL,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`)
		setSchemaVersion(8)
	}

	if (currentVersion < 9) {
		const todoCols = db.prepare("PRAGMA table_info(todos)").all() as { name: string }[]
		if (!todoCols.some(c => c.name === 'description')) {
			db.exec(`ALTER TABLE todos ADD COLUMN description TEXT;`)
		}
		setSchemaVersion(9)
	}

	if (currentVersion < 10) {
		const todoCols = db.prepare("PRAGMA table_info(todo_lists)").all() as { name: string }[]
		if (!todoCols.some(c => c.name === 'sync_id')) {
			db.exec(`ALTER TABLE todo_lists ADD COLUMN sync_id TEXT;`)
		}
		if (!todoCols.some(c => c.name === 'sync_secret')) {
			db.exec(`ALTER TABLE todo_lists ADD COLUMN sync_secret TEXT;`)
		}
		if (!todoCols.some(c => c.name === 'is_shared')) {
			db.exec(`ALTER TABLE todo_lists ADD COLUMN is_shared INTEGER DEFAULT 0;`)
		}
		setSchemaVersion(10)
	}

}

runMigrations()

export default db
