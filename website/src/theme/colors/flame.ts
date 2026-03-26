import { defineSemanticTokens } from '@pandacss/dev'

export const flame = defineSemanticTokens.colors({
  '1': { value: { _light: '#fffcfa', _dark: '#1b0e07' } },
  '2': { value: { _light: '#fff7f0', _dark: '#24150a' } },
  '3': { value: { _light: '#ffe9d5', _dark: '#3a200c' } },
  '4': { value: { _light: '#ffd9b8', _dark: '#4d2b0c' } },
  '5': { value: { _light: '#ffc899', _dark: '#60370f' } },
  '6': { value: { _light: '#f5b17e', _dark: '#764615' } },
  '7': { value: { _light: '#e8955c', _dark: '#955a1e' } },
  '8': { value: { _light: '#d67535', _dark: '#b87028' } },
  '9': { value: { _light: '#ff690a', _dark: '#ff690a' } },
  '10': { value: { _light: '#ee5f06', _dark: '#ff7e30' } },
  '11': { value: { _light: '#c44e00', _dark: '#ff9d5c' } },
  '12': { value: { _light: '#451a03', _dark: '#ffe4ce' } },
  a1: { value: { _light: '#c0400004', _dark: '#fe6b0006' } },
  a2: { value: { _light: '#ff6b000f', _dark: '#fb650015' } },
  a3: { value: { _light: '#ff6a002a', _dark: '#fd6c002c' } },
  a4: { value: { _light: '#ff640047', _dark: '#fe6b003f' } },
  a5: { value: { _light: '#ff5e0066', _dark: '#ff6e0052' } },
  a6: { value: { _light: '#ef560081', _dark: '#ff750060' } },
  a7: { value: { _light: '#e04b00a3', _dark: '#ff7f0087' } },
  a8: { value: { _light: '#cf4100ca', _dark: '#ff8500aa' } },
  a9: { value: { _light: '#ff690af5', _dark: '#ff690a' } },
  a10: { value: { _light: '#ee5b00f9', _dark: '#ff7e30' } },
  a11: { value: { _light: '#c44e00', _dark: '#ff9d5c' } },
  a12: { value: { _light: '#3f1500f8', _dark: '#ffe4ce' } },
  solid: {
    bg: {
      DEFAULT: { value: { _light: '{colors.flame.9}', _dark: '{colors.flame.9}' } },
      hover: { value: { _light: '{colors.flame.10}', _dark: '{colors.flame.10}' } },
    },
    fg: { DEFAULT: { value: { _light: 'white', _dark: 'white' } } },
  },
  subtle: {
    bg: {
      DEFAULT: { value: { _light: '{colors.flame.a3}', _dark: '{colors.flame.a3}' } },
      hover: { value: { _light: '{colors.flame.a4}', _dark: '{colors.flame.a4}' } },
      active: { value: { _light: '{colors.flame.a5}', _dark: '{colors.flame.a5}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.flame.a11}', _dark: '{colors.flame.a11}' } } },
  },
  surface: {
    bg: {
      DEFAULT: { value: { _light: '{colors.flame.a2}', _dark: '{colors.flame.a2}' } },
      active: { value: { _light: '{colors.flame.a3}', _dark: '{colors.flame.a3}' } },
    },
    border: {
      DEFAULT: { value: { _light: '{colors.flame.a6}', _dark: '{colors.flame.a6}' } },
      hover: { value: { _light: '{colors.flame.a7}', _dark: '{colors.flame.a7}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.flame.a11}', _dark: '{colors.flame.a11}' } } },
  },
  outline: {
    bg: {
      hover: { value: { _light: '{colors.flame.a2}', _dark: '{colors.flame.a2}' } },
      active: { value: { _light: '{colors.flame.a3}', _dark: '{colors.flame.a3}' } },
    },
    border: { DEFAULT: { value: { _light: '{colors.flame.a7}', _dark: '{colors.flame.a7}' } } },
    fg: { DEFAULT: { value: { _light: '{colors.flame.a11}', _dark: '{colors.flame.a11}' } } },
  },
  plain: {
    bg: {
      hover: { value: { _light: '{colors.flame.a3}', _dark: '{colors.flame.a3}' } },
      active: { value: { _light: '{colors.flame.a4}', _dark: '{colors.flame.a4}' } },
    },
    fg: { DEFAULT: { value: { _light: '{colors.flame.a11}', _dark: '{colors.flame.a11}' } } },
  },
})
