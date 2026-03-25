import { registerNotesHandlers } from './notes-handlers.js'
import { registerListsHandlers } from './lists-handlers.js'
import { registerTagsHandlers } from './tags-handlers.js'
import { registerTodosHandlers } from './todos-handlers.js'
import { registerSearchHandlers } from './search-handlers.js'
import { registerSettingsHandlers } from './settings-handlers.js'
import { registerDailyHandlers } from './daily-handlers.js'
import { registerTodoListsHandlers } from './todo-lists-handlers.js'
import { registerExportHandlers } from './export-handlers.js'

export function registerAllHandlers() {
	registerNotesHandlers()
	registerListsHandlers()
	registerTagsHandlers()
	registerTodosHandlers()
	registerTodoListsHandlers()
	registerSearchHandlers()
	registerSettingsHandlers()
	registerDailyHandlers()
	registerExportHandlers()
}
