/**
 * Timestamped logger for sync debugging.
 * All sync-related modules should use this instead of raw console.log/warn/error.
 */
function ts(): string {
	const d = new Date()
	return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

export const syncLog = {
	info: (tag: string, ...args: unknown[]) => console.log(`[${ts()}][${tag}]`, ...args),
	warn: (tag: string, ...args: unknown[]) => console.warn(`[${ts()}][${tag}]`, ...args),
	error: (tag: string, ...args: unknown[]) => console.error(`[${ts()}][${tag}]`, ...args),
}
