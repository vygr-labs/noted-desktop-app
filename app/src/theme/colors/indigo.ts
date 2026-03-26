import { defineSemanticTokens } from '@pandacss/dev'

// Brand red palette — centered on noted logo gradient (#CE2100)
export const indigo = defineSemanticTokens.colors({
	'1': { value: { _light: '#fffcfc', _dark: '#191111' } },
	'2': { value: { _light: '#fff8f7', _dark: '#201413' } },
	'3': { value: { _light: '#ffece6', _dark: '#3b1613' } },
	'4': { value: { _light: '#ffdbd0', _dark: '#501510' } },
	'5': { value: { _light: '#ffcbbc', _dark: '#611c14' } },
	'6': { value: { _light: '#f9b6a5', _dark: '#72281c' } },
	'7': { value: { _light: '#f0a08e', _dark: '#8a3728' } },
	'8': { value: { _light: '#e48670', _dark: '#b04a33' } },
	'9': { value: { _light: '#CE2100', _dark: '#CE2100' } },
	'10': { value: { _light: '#c01e00', _dark: '#e54128' } },
	'11': { value: { _light: '#a41a00', _dark: '#ff8b73' } },
	'12': { value: { _light: '#551e14', _dark: '#ffd1c7' } },
	a1: { value: { _light: '#ff000003', _dark: '#f0120008' } },
	a2: { value: { _light: '#ff200008', _dark: '#ff40200f' } },
	a3: { value: { _light: '#ff260019', _dark: '#ff30182b' } },
	a4: { value: { _light: '#ff1f002f', _dark: '#ff200e42' } },
	a5: { value: { _light: '#ff1c0043', _dark: '#ff301853' } },
	a6: { value: { _light: '#f017005a', _dark: '#ff451c64' } },
	a7: { value: { _light: '#e0160071', _dark: '#ff5a267e' } },
	a8: { value: { _light: '#d413008f', _dark: '#ff6025a1' } },
	a9: { value: { _light: '#ce2100', _dark: '#fe3000ef' } },
	a10: { value: { _light: '#c01e00', _dark: '#ff4f28e8' } },
	a11: { value: { _light: '#a41a00', _dark: '#ff8b73' } },
	a12: { value: { _light: '#3b0800eb', _dark: '#ffd1c7fd' } },
	solid: {
		bg: {
			DEFAULT: { value: { _light: '{colors.indigo.9}', _dark: '{colors.indigo.9}' } },
			hover: { value: { _light: '{colors.indigo.10}', _dark: '{colors.indigo.10}' } },
		},
		fg: { DEFAULT: { value: { _light: 'white', _dark: 'white' } } },
	},
	subtle: {
		bg: {
			DEFAULT: { value: { _light: '{colors.indigo.a3}', _dark: '{colors.indigo.a3}' } },
			hover: { value: { _light: '{colors.indigo.a4}', _dark: '{colors.indigo.a4}' } },
			active: { value: { _light: '{colors.indigo.a5}', _dark: '{colors.indigo.a5}' } },
		},
		fg: { DEFAULT: { value: { _light: '{colors.indigo.a11}', _dark: '{colors.indigo.a11}' } } },
	},
	surface: {
		bg: {
			DEFAULT: { value: { _light: '{colors.indigo.a2}', _dark: '{colors.indigo.a2}' } },
			active: { value: { _light: '{colors.indigo.a3}', _dark: '{colors.indigo.a3}' } },
		},
		border: {
			DEFAULT: { value: { _light: '{colors.indigo.a6}', _dark: '{colors.indigo.a6}' } },
			hover: { value: { _light: '{colors.indigo.a7}', _dark: '{colors.indigo.a7}' } },
		},
		fg: { DEFAULT: { value: { _light: '{colors.indigo.a11}', _dark: '{colors.indigo.a11}' } } },
	},
	outline: {
		bg: {
			hover: { value: { _light: '{colors.indigo.a2}', _dark: '{colors.indigo.a2}' } },
			active: { value: { _light: '{colors.indigo.a3}', _dark: '{colors.indigo.a3}' } },
		},
		border: { DEFAULT: { value: { _light: '{colors.indigo.a7}', _dark: '{colors.indigo.a7}' } } },
		fg: { DEFAULT: { value: { _light: '{colors.indigo.a11}', _dark: '{colors.indigo.a11}' } } },
	},
	plain: {
		bg: {
			hover: { value: { _light: '{colors.indigo.a3}', _dark: '{colors.indigo.a3}' } },
			active: { value: { _light: '{colors.indigo.a4}', _dark: '{colors.indigo.a4}' } },
		},
		fg: { DEFAULT: { value: { _light: '{colors.indigo.a11}', _dark: '{colors.indigo.a11}' } } },
	},
	text: { DEFAULT: { value: { _light: '{colors.indigo.a11}', _dark: '{colors.indigo.a11}' } } },
})
