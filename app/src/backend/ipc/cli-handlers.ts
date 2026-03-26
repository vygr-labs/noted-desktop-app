import { ipcMain, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function getCliScriptPath(): string {
	// In production: extraResources/cli/build/noted-cli.js
	// In dev: cli/build/noted-cli.js (project root)
	const resourcesPath = process.resourcesPath
	const prodPath = path.join(resourcesPath, 'cli', 'build', 'noted-cli.js')
	if (fs.existsSync(prodPath)) return prodPath

	// Dev fallback
	return path.join(app.getAppPath(), '..', '..', 'cli', 'build', 'noted-cli.js')
}

function getElectronBinaryPath(): string {
	// In production: the installed executable
	return app.getPath('exe')
}

function getWrapperPath(): string {
	const platform = process.platform
	if (platform === 'win32') {
		// Place in the app's install directory (next to the exe)
		const appDir = path.dirname(getElectronBinaryPath())
		return path.join(appDir, 'noted-cli.cmd')
	} else {
		// macOS/Linux: /usr/local/bin or ~/.local/bin
		const localBin = path.join(os.homedir(), '.local', 'bin')
		return path.join(localBin, 'noted-cli')
	}
}

function generateWrapperContent(): string {
	const electronBin = getElectronBinaryPath()
	const cliScript = getCliScriptPath()
	const appModules = path.join(path.dirname(electronBin), 'resources', 'app.asar.unpacked', 'node_modules')
	// Fallback to regular app node_modules if unpacked doesn't exist
	const appModules2 = path.join(path.dirname(electronBin), 'resources', 'app', 'node_modules')

	if (process.platform === 'win32') {
		return `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\nset NODE_PATH=${appModules};${appModules2}\r\n"${electronBin}" "${cliScript}" %*\r\n`
	} else {
		return `#!/bin/bash\nexport ELECTRON_RUN_AS_NODE=1\nexport NODE_PATH="${appModules}:${appModules2}"\nexec "${electronBin}" "${cliScript}" "$@"\n`
	}
}

function addToWindowsPath(dir: string): void {
	// Add the directory to the user's PATH via registry
	try {
		const { execSync } = require('child_process')
		const currentPath = execSync('reg query "HKCU\\Environment" /v Path', { encoding: 'utf-8' })
		const match = currentPath.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i)
		const existingPath = match ? match[1].trim() : ''

		if (!existingPath.toLowerCase().includes(dir.toLowerCase())) {
			const newPath = existingPath ? `${existingPath};${dir}` : dir
			execSync(`reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`)
			// Broadcast WM_SETTINGCHANGE so explorer picks up the change
			execSync('setx NOTED_CLI_INSTALLED 1 >nul 2>&1', { encoding: 'utf-8' })
		}
	} catch {
		// Non-fatal — user can add to PATH manually
	}
}

function removeFromWindowsPath(dir: string): void {
	try {
		const { execSync } = require('child_process')
		const currentPath = execSync('reg query "HKCU\\Environment" /v Path', { encoding: 'utf-8' })
		const match = currentPath.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i)
		if (!match) return
		const parts = match[1].trim().split(';').filter((p: string) => p.toLowerCase() !== dir.toLowerCase())
		execSync(`reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${parts.join(';')}" /f`)
	} catch {
		// Non-fatal
	}
}

export function registerCliHandlers() {
	ipcMain.handle('cli:install', () => {
		try {
			const wrapperPath = getWrapperPath()
			const wrapperDir = path.dirname(wrapperPath)
			const content = generateWrapperContent()

			if (!fs.existsSync(wrapperDir)) {
				fs.mkdirSync(wrapperDir, { recursive: true })
			}

			fs.writeFileSync(wrapperPath, content, { mode: 0o755 })

			// On Windows, add app directory to PATH if not already there
			if (process.platform === 'win32') {
				addToWindowsPath(wrapperDir)
			}

			return { success: true, path: wrapperPath }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			return { success: false, error: message }
		}
	})

	ipcMain.handle('cli:uninstall', () => {
		try {
			const wrapperPath = getWrapperPath()
			if (fs.existsSync(wrapperPath)) {
				fs.unlinkSync(wrapperPath)
			}

			if (process.platform === 'win32') {
				removeFromWindowsPath(path.dirname(wrapperPath))
			}

			return { success: true }
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err)
			return { success: false, error: message }
		}
	})

	ipcMain.handle('cli:is-installed', () => {
		const wrapperPath = getWrapperPath()
		return fs.existsSync(wrapperPath)
	})
}
