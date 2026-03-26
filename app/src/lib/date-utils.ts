export function getTodayDate(): string {
	return new Date().toISOString().split('T')[0]
}

export function formatDate(dateStr: string): string {
	const date = new Date(dateStr)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return 'Just now'
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
	})
}

export function formatDailyDate(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00')
	const today = getTodayDate()
	const yesterday = new Date()
	yesterday.setDate(yesterday.getDate() - 1)
	const yesterdayStr = yesterday.toISOString().split('T')[0]

	if (dateStr === today) return 'Today'
	if (dateStr === yesterdayStr) return 'Yesterday'

	return date.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	})
}

export function isOverdue(dateStr: string): boolean {
	return dateStr < getTodayDate()
}

export function isToday(dateStr: string): boolean {
	return dateStr === getTodayDate()
}

export function formatCreatedDate(dateStr: string): string {
	return formatDate(dateStr)
}

export function formatRelativeEdited(dateStr: string): string {
	return `edited ${formatDate(dateStr).toLowerCase()}`
}

export function getGreeting(): string {
	const hour = new Date().getHours()
	if (hour < 12) return 'Good morning!'
	if (hour < 18) return 'Good afternoon!'
	return 'Good evening!'
}
