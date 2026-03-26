// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
	let timer: ReturnType<typeof setTimeout> | null = null
	let lastArgs: Parameters<T> | null = null
	const debounced = (...args: Parameters<T>) => {
		lastArgs = args
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			fn(...args)
			timer = null
			lastArgs = null
		}, delay)
	}
	debounced.cancel = () => {
		if (timer) {
			clearTimeout(timer)
			timer = null
			lastArgs = null
		}
	}
	debounced.flush = () => {
		if (timer && lastArgs) {
			clearTimeout(timer)
			timer = null
			fn(...lastArgs)
			lastArgs = null
		}
	}
	return debounced
}
