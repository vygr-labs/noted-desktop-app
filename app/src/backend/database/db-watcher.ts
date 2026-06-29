import db from './db.js'

// ─── External DB change detection ────────────────────────
//
// The app's main process holds a single SQLite connection (see db.ts), shared
// by every window through the IPC handlers. The standalone `noted-cli` tool
// opens its OWN connection in a separate process.
//
// `PRAGMA data_version` is the perfect signal here: SQLite guarantees the value
// only changes when *another* connection commits a write — it is never bumped by
// the app's own writes (autosave, sync, etc.). So polling it lets us detect CLI
// edits with zero false positives from the app's constant background writes,
// and without the unreliability of fs.watch on a WAL database.

let lastDataVersion: number | null = null
let timer: ReturnType<typeof setInterval> | null = null

// Prepared once and reused every tick (re-preparing the statement each second
// for the app's whole lifetime is pure waste). `.pluck()` returns the scalar
// directly, skipping a per-tick row-object allocation.
let dataVersionStmt: { get(): number | undefined } | null = null

function readDataVersion(): number | null {
	try {
		if (!dataVersionStmt) {
			dataVersionStmt = db
				.prepare('PRAGMA data_version')
				.pluck() as unknown as { get(): number | undefined }
		}
		const v = dataVersionStmt.get()
		return typeof v === 'number' ? v : null
	} catch {
		return null
	}
}

/**
 * Start polling for external (CLI) writes. `onExternalChange` fires once per
 * detected external commit batch. Safe to call once at startup.
 */
export function startDbWatcher(onExternalChange: () => void, intervalMs = 1000): void {
	if (timer) return
	lastDataVersion = readDataVersion()
	timer = setInterval(() => {
		const v = readDataVersion()
		if (v === null) return
		if (lastDataVersion !== null && v !== lastDataVersion) {
			lastDataVersion = v
			onExternalChange()
		} else {
			lastDataVersion = v
		}
	}, intervalMs)
	// Don't keep the event loop alive solely for this poller.
	if (timer.unref) timer.unref()
}

export function stopDbWatcher(): void {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
}
