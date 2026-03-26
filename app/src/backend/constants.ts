import electronIsDev from 'electron-is-dev'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const RESOURCES_PATH = electronIsDev
	? path.join(__dirname, '../../assets')
	: path.join(process.resourcesPath, 'assets')
const userData = app.getPath('userData')

const DB_PATH = path.join(userData, 'databases')

function createAppPaths(paths: string[]) {
	paths.map(path => {
		if (!fs.existsSync(path)) {
			fs.mkdir(path, { recursive: true }, err => {
				if (err) throw err
				console.log(`Path --${path}-- Created Successfully`)
			})
		}
	})
}

createAppPaths([DB_PATH])

// ─── App config (editable defaults) ──────────────────────

interface AppConfig {
	syncServerUrl: string
	syncAuthToken: string
}

function loadAppConfig(): AppConfig {
	const defaults: AppConfig = {
		syncServerUrl: 'wss://noted-sync.fly.dev',
		syncAuthToken: '',
	}

	try {
		// In production: config is in resources; in dev: project root
		const paths = [
			path.join(process.resourcesPath || '', 'app.config.json'),
			path.join(__dirname, '../../app.config.json'),
		]
		for (const p of paths) {
			if (fs.existsSync(p)) {
				const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
				return { ...defaults, ...data }
			}
		}
	} catch {
		// Fall back to defaults
	}

	return defaults
}

const APP_CONFIG = loadAppConfig()

export { __dirname, RESOURCES_PATH, DB_PATH, APP_CONFIG }
