import { fetchDailyNote, createNote } from './note-operations.js'
import type { Note } from './note-operations.js'

export function getOrCreateDailyNote(date: string): Note {
	const existing = fetchDailyNote(date)
	if (existing) return existing

	const dateObj = new Date(date + 'T00:00:00')
	const title = dateObj.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	})

	return createNote({
		title,
		is_daily: true,
		daily_date: date,
		note_type: 'rich',
	})
}
