import { css } from 'styled-system/css'
import { Box, Flex } from 'styled-system/jsx'
import { createSignal, For, onMount } from 'solid-js'

/* ================================================================
   Shared Styles
   ================================================================ */

export const navLinkClass = css({
  fontSize: 'xs',
  fontWeight: 'medium',
  color: 'fg.muted',
  textDecoration: 'none',
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  transition: 'color 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
  _hover: { color: 'indigo.9' },
})

export const bentoCardClass = css({
  p: { base: '6', lg: '8' },
  borderRadius: 'sm',
  cursor: 'default',
  overflow: 'hidden',
  transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
  _hover: { transform: 'translateY(-4px)' },
})

export const monoLabelStyle = {
  'font-family': "'JetBrains Mono', monospace",
  'font-size': '0.6875rem',
  'text-transform': 'uppercase',
  'letter-spacing': '0.1em',
} as const

/* ================================================================
   Icons
   ================================================================ */

export function GitHubIcon(props: { size?: number }) {
  const s = props.size ?? 20
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

/* ================================================================
   Helpers
   ================================================================ */

function scrollToSection(id: string) {
  return (e: MouseEvent) => {
    const el = document.getElementById(id)
    if (el) {
      e.preventDefault()
      const top = el.getBoundingClientRect().top + window.scrollY - 80
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }
}

/* ================================================================
   Theme Toggle
   ================================================================ */

function ThemeToggle() {
  const [dark, setDark] = createSignal(false)

  onMount(() => {
    setDark(document.documentElement.classList.contains('dark'))
  })

  const toggle = () => {
    const next = !dark()
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('noted-theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      class={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        w: '8',
        h: '8',
        borderRadius: 'sm',
        cursor: 'pointer',
        border: 'none',
        color: 'fg.muted',
        transition: 'all 0.2s',
        _hover: { color: 'fg.default' },
      })}
      style={{ 'background-color': 'var(--surface-high)' }}
    >
      {dark() ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

/* ================================================================
   Navigation
   ================================================================ */

export function Nav() {
  const [dark, setDark] = createSignal(false)
  const [menuOpen, setMenuOpen] = createSignal(false)

  onMount(() => {
    setDark(document.documentElement.classList.contains('dark'))

    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })

  return (
    <nav
      class={`animate-slide-down ${css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        pt: '3',
        px: { base: '3', md: '6' },
      })}`}
      style={{ 'background-color': 'transparent' }}
    >
      <Box maxW="7xl" mx="auto" px={{ base: '0', md: '6' }}>
        <Box
          borderRadius="sm"
          style={{
            'background-color': 'var(--surface-low)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <Flex justifyContent="space-between" alignItems="center" py="3" px={{ base: '3', md: '5' }}>
            <Flex alignItems="center" gap={{ base: '4', md: '8' }}>
              <a href="/" class={css({ textDecoration: 'none' })}>
                <img
                  src={dark() ? '/noted-logo-white.svg' : '/noted-logo.svg'}
                  alt="noted."
                  class={css({ h: { base: '5', md: '6' } })}
                />
              </a>
              <Flex display={{ base: 'none', md: 'flex' }} alignItems="center" gap="6">
                <a href="/#features" onClick={scrollToSection('features')} class={navLinkClass}>Features</a>
                <a href="/download" class={navLinkClass}>Download</a>
                <a href="https://github.com/vygr-labs/noted-desktop-app" target="_blank" rel="noopener noreferrer" class={navLinkClass}>GitHub</a>
              </Flex>
            </Flex>

            <Flex alignItems="center" gap="2">
              <ThemeToggle />
              <a
                href="/download?auto"
                class={css({
                  display: { base: 'none', sm: 'inline-flex' },
                  alignItems: 'center',
                  px: '5',
                  py: '2',
                  borderRadius: 'sm',
                  color: 'white',
                  fontWeight: 'semibold',
                  fontSize: 'sm',
                  textDecoration: 'none',
                  transition: 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                  _active: { transform: 'scale(0.95)' },
                })}
                style={{ 'background-color': '#7a0d02' }}
              >
                Download
              </a>
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen())}
                aria-label="Toggle menu"
                class={css({
                  display: { base: 'flex', md: 'none' },
                  alignItems: 'center',
                  justifyContent: 'center',
                  w: '8',
                  h: '8',
                  borderRadius: 'sm',
                  cursor: 'pointer',
                  border: 'none',
                  color: 'fg.muted',
                  _hover: { color: 'fg.default' },
                })}
                style={{ 'background-color': 'var(--surface-high)' }}
              >
                {menuOpen() ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </Flex>
          </Flex>

          {/* Mobile menu dropdown */}
          {menuOpen() && (
            <Flex
              flexDirection="column"
              gap="1"
              px={{ base: '3', md: '5' }}
              pb="3"
              display={{ md: 'none' }}
            >
              <a
                href="/#features"
                onClick={(e) => { scrollToSection('features')(e); setMenuOpen(false) }}
                class={css({
                  py: '2.5',
                  px: '3',
                  borderRadius: 'sm',
                  textDecoration: 'none',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'fg.muted',
                  _hover: { color: 'fg.default' },
                })}
                style={{ 'background-color': 'var(--surface-high)' }}
              >
                Features
              </a>
              <a
                href="/download"
                class={css({
                  py: '2.5',
                  px: '3',
                  borderRadius: 'sm',
                  textDecoration: 'none',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'fg.muted',
                  _hover: { color: 'fg.default' },
                })}
                style={{ 'background-color': 'var(--surface-high)' }}
              >
                Download
              </a>
              <a
                href="https://github.com/vygr-labs/noted-desktop-app"
                target="_blank"
                rel="noopener noreferrer"
                class={css({
                  py: '2.5',
                  px: '3',
                  borderRadius: 'sm',
                  textDecoration: 'none',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: 'fg.muted',
                  _hover: { color: 'fg.default' },
                })}
                style={{ 'background-color': 'var(--surface-high)' }}
              >
                GitHub
              </a>
            </Flex>
          )}
        </Box>
      </Box>
    </nav>
  )
}

/* ================================================================
   Footer Card (full-width bento card)
   ================================================================ */

export function FooterCard(props: { staggerRef?: (el: HTMLElement) => void }) {
  return (
    <div
      ref={props.staggerRef}
      data-stagger=""
      class={bentoCardClass}
      style={{
        'grid-column': '1 / -1',
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
      }}
    >
      <Flex
        flexDirection={{ base: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems="center"
        gap="6"
      >
        <Flex flexDirection="column" alignItems={{ base: 'center', md: 'flex-start' }} gap="3">
          <img src="/noted-logo.svg" alt="noted." class={css({ h: '5', _dark: { display: 'none' } })} />
          <img src="/noted-logo-white.svg" alt="noted." class={css({ h: '5', display: 'none', _dark: { display: 'block' } })} />
          <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)' }}>
            &copy; 2026 noted. All rights reserved. Voyager Technologies
          </span>
        </Flex>

        <Flex gap={{ base: '4', md: '8' }} flexWrap="wrap" justifyContent="center">
          <For each={[{ label: 'Features', href: '/#features' }, { label: 'Download', href: '/download' }, { label: 'GitHub', href: 'https://github.com/vygr-labs/noted-desktop-app' }]}>
            {(link) => (
              <a
                href={link.href}
                onClick={link.href.includes('#') ? scrollToSection(link.href.split('#')[1]) : undefined}
                target={link.label === 'GitHub' ? '_blank' : undefined}
                rel={link.label === 'GitHub' ? 'noopener noreferrer' : undefined}
                style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)', 'text-decoration': 'none', transition: 'color 0.3s' }}
                class={css({ py: '1', _hover: { color: 'fg.default' } })}
              >
                {link.label}
              </a>
            )}
          </For>
        </Flex>

        <Flex alignItems="center" gap="4">
          <a
            href="https://github.com/vygr-labs/noted-desktop-app"
            target="_blank"
            rel="noopener noreferrer"
            class={css({ color: 'fg.subtle', transition: 'color 0.3s', _hover: { color: 'indigo.9' } })}
          >
            <GitHubIcon />
          </a>
        </Flex>
      </Flex>
    </div>
  )
}
