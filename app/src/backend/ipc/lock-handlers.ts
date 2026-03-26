import { ipcMain, systemPreferences } from 'electron'
import crypto from 'node:crypto'
import db from '../database/db.js'
import { getSetting, setSetting } from '../database/settings-operations.js'

function hashPin(pin: string, salt: string): string {
	return crypto.scryptSync(pin, salt, 64).toString('hex')
}

export function registerLockHandlers() {
	// Check if a PIN has been set
	ipcMain.handle('lock:has-pin', () => {
		return !!getSetting('lock_pin_hash')
	})

	// Set or update the PIN
	ipcMain.handle('lock:set-pin', (_, pin: string) => {
		const salt = crypto.randomBytes(16).toString('hex')
		const hash = hashPin(pin, salt)
		setSetting('lock_pin_hash', hash)
		setSetting('lock_pin_salt', salt)
		return true
	})

	// Remove the PIN
	ipcMain.handle('lock:remove-pin', () => {
		setSetting('lock_pin_hash', '')
		setSetting('lock_pin_salt', '')
		// Unlock all notes
		db.prepare('UPDATE notes SET is_locked = 0').run()
		return true
	})

	// Verify a PIN
	ipcMain.handle('lock:verify-pin', (_, pin: string) => {
		const storedHash = getSetting('lock_pin_hash')
		const salt = getSetting('lock_pin_salt')
		if (!storedHash || !salt) return false
		const hash = hashPin(pin, salt)
		return hash === storedHash
	})

	// Toggle lock on a note
	ipcMain.handle('lock:toggle-note', (_, noteId: string) => {
		const note = db.prepare('SELECT is_locked FROM notes WHERE id = ?').get(noteId) as
			| { is_locked: number }
			| undefined
		if (!note) return false
		const newState = note.is_locked ? 0 : 1
		db.prepare('UPDATE notes SET is_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newState, noteId)
		return newState === 1
	})

	// Check biometric availability
	ipcMain.handle('lock:biometric-available', () => {
		if (process.platform === 'darwin') {
			return systemPreferences.canPromptTouchID()
		}
		return false
	})

	// Authenticate via biometric
	ipcMain.handle('lock:biometric-authenticate', async () => {
		if (process.platform === 'darwin') {
			try {
				await systemPreferences.promptTouchID('unlock a locked note')
				return true
			} catch {
				return false
			}
		}
		return false
	})
}
