import { css } from '../../../styled-system/css'

const logoWrap = css({
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	position: 'relative',
})

export function NotedLogo(props: { size?: number; class?: string }) {
	const s = props.size || 80

	return (
		<div class={`${logoWrap} ${props.class || ''}`}>
			<svg
				width={s}
				height={s * 0.5}
				viewBox="0 0 160 80"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				{/* Squiggly circle — hand-drawn feel */}
				<path
					d="M80 8
					   C 105 5, 132 12, 145 28
					   C 158 44, 155 60, 140 68
					   C 125 76, 105 78, 80 76
					   C 55 78, 35 76, 20 68
					   C 5 60, 2 44, 15 28
					   C 28 12, 55 5, 80 8Z"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					fill="none"
					style={{
						'stroke-dasharray': '4 0',
					}}
				/>
				{/* Second squiggly line — offset for hand-drawn doubling */}
				<path
					d="M78 11
					   C 102 7, 130 15, 143 30
					   C 154 43, 153 58, 138 66
					   C 123 74, 103 76, 80 74
					   C 57 76, 37 74, 22 66
					   C 7 58, 6 43, 17 30
					   C 30 15, 58 7, 78 11Z"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linecap="round"
					fill="none"
					opacity="0.4"
				/>
				{/* Small decorative squiggle at top-right — like a pen flick */}
				<path
					d="M138 22 C 142 18, 148 17, 152 20"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					fill="none"
				/>
				{/* The word "noted" */}
				<text
					x="80"
					y="48"
					text-anchor="middle"
					dominant-baseline="central"
					font-family="'Inter', -apple-system, sans-serif"
					font-weight="700"
					font-size="28"
					letter-spacing="-1.5"
					fill="currentColor"
				>
					noted
				</text>
				{/* Small dot accent on the 'd' descender area — playful touch */}
				<circle
					cx="132"
					cy="56"
					r="2.5"
					fill="var(--colors-indigo-9, #CE2100)"
				/>
			</svg>
		</div>
	)
}

/** Small icon-only version for favicon / compact spaces */
export function NotedIcon(props: { size?: number; class?: string }) {
	const s = props.size || 22

	return (
		<svg
			class={props.class}
			width={s}
			height={s}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			{/* Squiggly circle */}
			<path
				d="M12 3
				   C 16 2.5, 20 4, 21.5 8
				   C 23 12, 22 16, 19.5 19
				   C 17 22, 14 22.5, 12 22.5
				   C 10 22.5, 7 22, 4.5 19
				   C 2 16, 1 12, 2.5 8
				   C 4 4, 8 2.5, 12 3Z"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				fill="none"
			/>
			{/* "n" letterform — simplified */}
			<text
				x="12"
				y="13.5"
				text-anchor="middle"
				dominant-baseline="central"
				font-family="'Inter', -apple-system, sans-serif"
				font-weight="700"
				font-size="11"
				letter-spacing="-0.5"
				fill="currentColor"
			>
				n
			</text>
			{/* Accent dot */}
			<circle cx="17.5" cy="16" r="1.5" fill="var(--colors-indigo-9, #CE2100)" />
		</svg>
	)
}
