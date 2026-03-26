import db from './db.js'

export interface SearchResult {
	note_id: string
	title: string
	snippet: string
}

export function searchNotes(query: string): SearchResult[] {
	if (!query.trim()) return []

	// Append * for prefix matching
	const ftsQuery = query
		.trim()
		.split(/\s+/)
		.map((word) => `"${word}"*`)
		.join(' ')

	return db
		.prepare(
			`SELECT note_id, title, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 40) as snippet
		 FROM notes_fts
		 WHERE notes_fts MATCH ?
		 ORDER BY rank
		 LIMIT 50`
		)
		.all(ftsQuery) as SearchResult[]
}
