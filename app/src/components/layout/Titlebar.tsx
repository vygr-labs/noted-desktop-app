import { createSignal, onMount, Show } from 'solid-js'
import { css } from '../../../styled-system/css'

const titlebarStyle = css({
	display: 'flex',
	alignItems: 'center',
	height: '42px',
	flexShrink: 0,
	bg: 'color-mix(in srgb, var(--colors-gray-2) 80%, transparent)',
	backdropFilter: 'blur(12px)',
	WebkitBackdropFilter: 'blur(12px)',
	userSelect: 'none',
	zIndex: 50,
	position: 'relative',
	// subtle bottom shadow instead of a hard border
	'&::after': {
		content: '""',
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		height: '1px',
		bg: 'gray.a3',
	},
})

const brandSection = css({
	display: 'flex',
	alignItems: 'center',
	height: '100%',
	px: '4',
	flexShrink: 0,
})

const dragRegion = css({
	flex: 1,
	height: '100%',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
})

const controlsRow = css({
	display: 'flex',
	alignItems: 'center',
	height: '100%',
	flexShrink: 0,
})

const controlBtn = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '46px',
	height: '100%',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'background 0.1s, color 0.1s',
	_hover: {
		bg: 'gray.a3',
		color: 'fg.default',
	},
})

const closeBtn = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '46px',
	height: '100%',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'background 0.1s, color 0.1s',
	_hover: {
		bg: 'red.9',
		color: 'white',
	},
})

export function Titlebar() {
	const [isMaximized, setIsMaximized] = createSignal(false)

	onMount(async () => {
		const maximized = await window.electronAPI.windowIsMaximized()
		setIsMaximized(maximized)

		window.electronAPI.onWindowMaximizeChange((val) => {
			setIsMaximized(val)
		})
	})

	return (
		<div class={titlebarStyle}>
			{/* Brand */}
			<div class={brandSection} style={{ '-webkit-app-region': 'drag' }}>
				<img
					src="./noted-logo.svg"
					alt="noted"
					style={{ height: '22px', 'pointer-events': 'none' }}
					draggable={false}
				/>
			</div>

			{/* Drag region */}
			<div class={dragRegion} style={{ '-webkit-app-region': 'drag' }} />

			{/* Window controls */}
			<div class={controlsRow} style={{ '-webkit-app-region': 'no-drag' }}>
				<button
					class={controlBtn}
					onClick={() => window.electronAPI.windowMinimize()}
					title="Minimize"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path d="M4 8h8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
					</svg>
				</button>
				<button
					class={controlBtn}
					onClick={() => window.electronAPI.windowMaximize()}
					title={isMaximized() ? 'Restore' : 'Maximize'}
				>
					<Show
						when={isMaximized()}
						fallback={
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.25" />
							</svg>
						}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<rect x="3" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.25" />
							<path d="M5 5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1" stroke="currentColor" stroke-width="1.25" />
						</svg>
					</Show>
				</button>
				<button
					class={closeBtn}
					onClick={() => window.electronAPI.windowClose()}
					title="Close"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
					</svg>
				</button>
			</div>
		</div>
	)
}
