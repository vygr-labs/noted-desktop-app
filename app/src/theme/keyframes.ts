import { defineKeyframes } from '@pandacss/dev'

export const keyframes = defineKeyframes({
  // collapse
  'expand-height': {
    from: { height: '0' },
    to: { height: 'var(--height)' },
  },
  'collapse-height': {
    from: { height: 'var(--height)' },
    to: { height: '0' },
  },
  'expand-width': {
    from: { width: '0' },
    to: { width: 'var(--width)' },
  },
  'collapse-width': {
    from: { width: 'var(--width)' },
    to: { width: '0' },
  },
  // fade
  'fade-in': {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  'fade-out': {
    from: { opacity: '1' },
    to: { opacity: '0' },
  },
  // slide from (full)
  'slide-from-left-full': {
    from: { translate: '-100% 0' },
    to: { translate: '0 0' },
  },
  'slide-from-right-full': {
    from: { translate: '100% 0' },
    to: { translate: '0 0' },
  },
  'slide-from-top-full': {
    from: { translate: '0 -100%' },
    to: { translate: '0 0' },
  },
  'slide-from-bottom-full': {
    from: { translate: '0 100%' },
    to: { translate: '0 0' },
  },
  // slide to (full)
  'slide-to-left-full': {
    from: { translate: '0 0' },
    to: { translate: '-100% 0' },
  },
  'slide-to-right-full': {
    from: { translate: '0 0' },
    to: { translate: '100% 0' },
  },
  'slide-to-top-full': {
    from: { translate: '0 0' },
    to: { translate: '0 -100%' },
  },
  'slide-to-bottom-full': {
    from: { translate: '0 0' },
    to: { translate: '0 100%' },
  },
  // slide from
  'slide-from-top': {
    '0%': { translate: '0 -0.5rem' },
    to: { translate: '0' },
  },
  'slide-from-bottom': {
    '0%': { translate: '0 0.5rem' },
    to: { translate: '0' },
  },
  'slide-from-left': {
    '0%': { translate: '-0.5rem 0' },
    to: { translate: '0' },
  },
  'slide-from-right': {
    '0%': { translate: '0.5rem 0' },
    to: { translate: '0' },
  },
  // slide to
  'slide-to-top': {
    '0%': { translate: '0' },
    to: { translate: '0 -0.5rem' },
  },
  'slide-to-bottom': {
    '0%': { translate: '0' },
    to: { translate: '0 0.5rem' },
  },
  'slide-to-left': {
    '0%': { translate: '0' },
    to: { translate: '-0.5rem 0' },
  },
  'slide-to-right': {
    '0%': { translate: '0' },
    to: { translate: '0.5rem 0' },
  },
  // scale
  'scale-in': {
    from: { scale: '0.95' },
    to: { scale: '1' },
  },
  'scale-out': {
    from: { scale: '1' },
    to: { scale: '0.95' },
  },
  'bg-position': {
    from: {
      backgroundPosition: 'var(--animate-from, 1rem) 0',
    },
    to: {
      backgroundPosition: 'var(--animate-to, 0) 0',
    },
  },
  position: {
    from: {
      insetInlineStart: 'var(--animate-from-x)',
      insetBlockStart: 'var(--animate-from-y)',
    },
    to: {
      insetInlineStart: 'var(--animate-to-x)',
      insetBlockStart: 'var(--animate-to-y)',
    },
  },

  // Custom animations for the UI overhaul
  'slide-up-fade': {
    from: { opacity: '0', transform: 'translateY(8px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
  },
  'slide-down-fade': {
    from: { opacity: '0', transform: 'translateY(-8px)' },
    to: { opacity: '1', transform: 'translateY(0)' },
  },
  'slide-in-left': {
    from: { opacity: '0', transform: 'translateX(-12px)' },
    to: { opacity: '1', transform: 'translateX(0)' },
  },
  'slide-out-right': {
    from: { opacity: '1', transform: 'translateX(0)' },
    to: { opacity: '0', transform: 'translateX(12px)' },
  },
  'card-enter': {
    from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
    to: { opacity: '1', transform: 'translateY(0) scale(1)' },
  },
  pulse: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.4' },
  },
  'save-pulse': {
    '0%': { transform: 'scale(1)', opacity: '1' },
    '50%': { transform: 'scale(1.2)', opacity: '0.7' },
    '100%': { transform: 'scale(1)', opacity: '1' },
  },
  'check-bounce': {
    '0%': { transform: 'scale(1)' },
    '30%': { transform: 'scale(1.15)' },
    '50%': { transform: 'scale(0.95)' },
    '100%': { transform: 'scale(1)' },
  },
  'modal-enter': {
    from: { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
    to: { opacity: '1', transform: 'scale(1) translateY(0)' },
  },
  'overlay-enter': {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  'progress-fill': {
    from: { width: '0%' },
    to: { width: 'var(--progress-width)' },
  },
  'accent-bar-enter': {
    from: { height: '0', opacity: '0' },
    to: { height: '100%', opacity: '1' },
  },
  shimmer: {
    from: { backgroundPosition: '200% 0' },
    to: { backgroundPosition: '-200% 0' },
  },
})
