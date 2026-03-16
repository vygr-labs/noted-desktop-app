import Database from 'better-sqlite3'
import path from 'node:path'
import { DB_PATH } from '../constants.js'

const dbFile = path.join(DB_PATH, 'app.sqlite')
const db = new Database(dbFile)

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
	CREATE TABLE IF NOT EXISTS notes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		content TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)
`)

export default db
