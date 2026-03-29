import { css } from 'styled-system/css'
import { Box, Flex } from 'styled-system/jsx'
import { createSignal, onMount, onCleanup, For } from 'solid-js'

/* ================================================================
   Hooks
   ================================================================ */

function createScrollReveal(delay: number = 0) {
  return (el: HTMLElement) => {
    el.classList.add('bento-reveal')
    el.style.transitionDelay = `${delay}s`

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('bento-revealed')
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 },
    )

    // Defer to next frame so initial styles apply before observing
    requestAnimationFrame(() => observer.observe(el))
    onCleanup(() => observer.disconnect())
  }
}

function createTypingAnimation(lines: string[], charDelay = 60, pauseDelay = 400) {
  const fullText = lines.join('\n')
  const [displayed, setDisplayed] = createSignal('')
  const [cursorHidden, setCursorHidden] = createSignal(false)

  onMount(() => {
    let i = 0
    let timeout: number

    const type = () => {
      if (i < fullText.length) {
        i++
        setDisplayed(fullText.slice(0, i))

        // Pause after newline
        if (fullText[i - 1] === '\n') {
          timeout = window.setTimeout(type, pauseDelay)
        } else {
          timeout = window.setTimeout(type, charDelay)
        }
      } else {
        // Done typing — hide cursor after 3s
        timeout = window.setTimeout(() => setCursorHidden(true), 3000)
      }
    }

    // Start after a brief initial delay
    timeout = window.setTimeout(type, 500)
    onCleanup(() => clearTimeout(timeout))
  })

  return { displayed, cursorHidden }
}

/* ================================================================
   Constants
   ================================================================ */

type ThemeName = 'light' | 'dark' | 'warm' | 'slate'

const THEME_LABELS: ThemeName[] = ['light', 'dark', 'warm', 'slate']

/* ================================================================
   Shared Styles
   ================================================================ */

const navLinkClass = css({
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

const bentoCardClass = css({
  p: { base: '6', lg: '8' },
  borderRadius: 'sm',
  cursor: 'default',
  overflow: 'hidden',
  transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
  _hover: { transform: 'translateY(-4px)' },
})

const monoLabelStyle = {
  'font-family': "'JetBrains Mono', monospace",
  'font-size': '0.6875rem',
  'text-transform': 'uppercase',
  'letter-spacing': '0.1em',
} as const

/* ================================================================
   Icons
   ================================================================ */

function GitHubIcon(props: { size?: number }) {
  const s = props.size ?? 20
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

/* ================================================================
   Navigation
   ================================================================ */

function Nav() {
  return (
    <nav
      class={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        px: '6',
        pt: '3',
      })}
      style={{ 'background-color': 'transparent' }}
    >
      <Box
        maxW="7xl"
        mx="auto"
        px="6"
        borderRadius="xl"
        style={{
          'background-color': 'var(--surface-low)',
          border: '1px solid var(--surface-border)',
        }}
      >
        <Flex justifyContent="space-between" alignItems="center" py="3">
          <Flex alignItems="center" gap="8">
            <a href="/" class={css({ textDecoration: 'none' })}>
              <span
                class={css({
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  letterSpacing: '-0.05em',
                  color: 'fg.default',
                })}
              >
                noted.
              </span>
            </a>
            <Flex display={{ base: 'none', md: 'flex' }} alignItems="center" gap="6">
              <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }} class={navLinkClass}>Features</a>
              <a href="/download" class={navLinkClass}>Download</a>
              <a href="https://github.com/vygr-labs/noted-desktop-app" target="_blank" rel="noopener noreferrer" class={navLinkClass}>GitHub</a>
            </Flex>
          </Flex>

          <Flex alignItems="center" gap="4">
            <a
              href="/download"
              class={css({
                display: 'inline-flex',
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
          </Flex>
        </Flex>
      </Box>
    </nav>
  )
}

/* ================================================================
   Hero Card (full-width bento card)
   ================================================================ */

function HeroCard() {
  const { displayed, cursorHidden } = createTypingAnimation(
    ['Your thoughts,', 'beautifully noted.'],
    60,
    400,
  )

  return (
    <div
      class={css({
        textAlign: 'center',
        px: { base: '6', md: '8', lg: '12' },
        py: { base: '10', md: '14', lg: '16' },
        borderRadius: 'sm',
        overflow: 'hidden',
      })}
      style={{
        'grid-column': '1 / -1',
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
      }}
    >
      {/* Open Source Badge */}
      <Box class="animate-fade-in-up" mb="6">
        <Flex
          display="inline-flex"
          alignItems="center"
          gap="2"
          px="3"
          py="1.5"
          borderRadius="md"
          style={{
            'background-color': 'var(--surface-high)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <Box color="#b0b4ba" flexShrink={0}>
            <TerminalIcon />
          </Box>
          <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)' }}>
            Open Source &amp; Local First
          </span>
        </Flex>
      </Box>

      {/* Typing Headline */}
      <h1
        class={`hero-gradient-text ${css({
          fontSize: { base: '4xl', md: '6xl', lg: '7xl' },
          fontWeight: 'extrabold',
          letterSpacing: '-0.04em',
          lineHeight: { base: '1.1', lg: '1.1' },
          mb: '6',
          minH: { base: '5rem', md: '7.5rem', lg: '8.5rem' },
        })}`}
      >
        <span class={css({ srOnly: true })}>Your thoughts, beautifully noted.</span>
        <span aria-hidden="true">
          {displayed().split('\n').map((line, i) => (
            <>
              {i > 0 && <br />}
              {line}
            </>
          ))}
          <span class={`typing-cursor${cursorHidden() ? ' typing-cursor--hidden' : ''}`}>|</span>
        </span>
      </h1>

      {/* Subtitle */}
      <p
        class={`animate-fade-in-up-delay-1 ${css({
          maxW: 'lg',
          mx: 'auto',
          fontSize: { base: 'md', lg: 'lg' },
          lineHeight: 'relaxed',
          mb: '8',
        })}`}
        style={{ color: 'var(--on-surface-variant)' }}
      >
        A fast, open-source editor that turns complex ideas into structured knowledge.
      </p>

      {/* CTAs */}
      <Flex
        flexDirection={{ base: 'column', sm: 'row' }}
        alignItems="center"
        justifyContent="center"
        gap="3"
        class="animate-fade-in-up-delay-2"
      >
        <a
          href="/download"
          class={css({
            w: { base: 'full', sm: 'auto' },
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: '7',
            py: '3.5',
            borderRadius: 'sm',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 'md',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            _hover: { transform: 'translateY(-2px)' },
            _active: { transform: 'translateY(0)' },
          })}
          style={{ 'background-color': '#7a0d02' }}
        >
          Download Free
        </a>
        <a
          href="https://github.com/vygr-labs/noted-desktop-app"
          target="_blank"
          rel="noopener noreferrer"
          class={css({
            w: { base: 'full', sm: 'auto' },
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            px: '7',
            py: '3.5',
            borderRadius: 'sm',
            color: 'fg.default',
            fontWeight: 'bold',
            fontSize: 'md',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            _hover: { transform: 'translateY(-2px)' },
            _active: { transform: 'translateY(0)' },
          })}
          style={{ border: '1px solid rgba(93, 64, 58, 0.3)' }}
        >
          <StarIcon />
          Star on GitHub
        </a>
      </Flex>
    </div>
  )
}

/* ================================================================
   Bento Card Wrapper
   ================================================================ */

function BentoCard(props: {
  children: any
  gridColumn?: { base?: string; md?: string; lg?: string }
  gridRow?: { base?: string; md?: string; lg?: string }
  delay?: number
  class?: string
}) {
  const reveal = createScrollReveal(props.delay ?? 0)

  return (
    <div
      ref={reveal}
      class={`${bentoCardClass} ${props.class ?? ''}`}
      style={{
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
        'grid-column': props.gridColumn?.lg ?? 'auto',
        'grid-row': props.gridRow?.lg ?? 'auto',
      }}
    >
      {props.children}
    </div>
  )
}

/* ================================================================
   Interactive Theme Card (2×2 star card)
   ================================================================ */

function ThemeCard() {
  const [active, setActive] = createSignal<ThemeName>('dark')
  const reveal = createScrollReveal(0)

  return (
    <div
      id="features"
      ref={reveal}
      class={`${bentoCardClass} ${css({
        display: 'flex',
        flexDirection: 'column',
      })}`}
      style={{
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
        'grid-column': 'span 2',
        'grid-row': 'span 2',
      }}
    >
      {/* Header */}
      <Flex alignItems="center" gap="3" mb="5">
        <Flex
          alignItems="center"
          justifyContent="center"
          w="10"
          h="10"
          borderRadius="lg"
          color="#b0b4ba"
          style={{ 'border': '1px solid var(--surface-border)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r="2.5" />
            <path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5z" />
            <path d="M2 12h4l2.5 3L12 9l3 6h7" />
          </svg>
        </Flex>
        <Box>
          <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default' })}>Beautiful Themes</h3>
          <p class={css({ fontSize: 'xs' })} style={{ color: 'var(--on-surface-variant)' }}>
            Switch between curated palettes
          </p>
        </Box>
      </Flex>

      {/* Theme Toggles */}
      <Flex gap="2" mb="5" flexWrap="wrap">
        <For each={THEME_LABELS}>
          {(name) => (
            <button
              onClick={() => setActive(name)}
              class={css({
                px: '3',
                py: '1.5',
                borderRadius: 'sm',
                fontSize: 'xs',
                fontWeight: 'semibold',
                textTransform: 'capitalize',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
              })}
              style={{
                'background-color': active() === name ? '#7a0d02' : 'var(--surface-high)',
                color: active() === name ? 'white' : 'var(--on-surface-variant)',
              }}
            >
              {name}
            </button>
          )}
        </For>
      </Flex>

      {/* Theme Screenshot Preview (crossfade between 4 images) */}
      <Box
        flex="1"
        borderRadius="lg"
        overflow="hidden"
        position="relative"
        style={{
          'background-color': 'var(--surface-container)',
          'aspect-ratio': '16 / 10',
        }}
      >
        <For each={THEME_LABELS}>
          {(name) => (
            <img
              src={`/screenshots/theme-${name}.png`}
              alt={`noted. editor in ${name} theme`}
              class={css({
                position: 'absolute',
                inset: '0',
                w: 'full',
                h: 'full',
                objectFit: 'cover',
                transition: 'opacity 0.4s ease',
              })}
              style={{ opacity: active() === name ? '1' : '0' }}
            />
          )}
        </For>
      </Box>
    </div>
  )
}

/* ================================================================
   Editor Card (1×1)
   ================================================================ */

function EditorCard() {
  return (
    <BentoCard delay={0.1}>
      <Flex
        alignItems="center"
        justifyContent="center"
        w="10"
        h="10"
        borderRadius="lg"
        mb="5"
        color="#b0b4ba"
        style={{ 'border': '1px solid var(--surface-border)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </Flex>
      <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default', mb: '2' })}>Rich Text Editor</h3>
      <p class={css({ fontSize: 'sm', lineHeight: 'relaxed' })} style={{ color: 'var(--on-surface-variant)' }}>
        Headings, lists, code blocks, tables, and task lists — all with a distraction-free interface.
      </p>
      {/* Decorative formatting pills */}
      <Flex gap="2" mt="5">
        <For each={['B', 'I', '</>']}>
          {(label) => (
            <Box
              px="2"
              py="1"
              borderRadius="md"
              fontSize="xs"
              fontWeight="semibold"
              style={{
                'background-color': 'var(--surface-high)',
                color: 'var(--on-surface-variant)',
                'font-family': label === '</>' ? "'JetBrains Mono', monospace" : 'inherit',
              }}
            >
              {label}
            </Box>
          )}
        </For>
      </Flex>
    </BentoCard>
  )
}

/* ================================================================
   Speed Card (1×1)
   ================================================================ */

function SpeedCard() {
  return (
    <BentoCard delay={0.2}>
      <Flex
        alignItems="center"
        justifyContent="center"
        w="10"
        h="10"
        borderRadius="lg"
        mb="5"
        color="#b0b4ba"
        style={{ 'border': '1px solid var(--surface-border)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </Flex>
      <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default', mb: '2' })}>Lightning Fast</h3>
      <Box
        my="3"
        fontSize="2xl"
        fontWeight="extrabold"
        color="#b0b4ba"
        style={{ 'font-family': "'JetBrains Mono', monospace" }}
      >
        Instant
      </Box>
      <p class={css({ fontSize: 'sm', lineHeight: 'relaxed' })} style={{ color: 'var(--on-surface-variant)' }}>
        Instant startup. Zero loading states. Buttery-smooth editing.
      </p>
    </BentoCard>
  )
}

/* ================================================================
   Privacy Card (1×1)
   ================================================================ */

function PrivacyCard() {
  return (
    <BentoCard delay={0.3}>
      <Flex
        alignItems="center"
        justifyContent="center"
        w="10"
        h="10"
        borderRadius="lg"
        mb="5"
        color="#b0b4ba"
        style={{ 'border': '1px solid var(--surface-border)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </Flex>
      <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default', mb: '2' })}>Privacy First</h3>
      <Box display="inline-flex" px="2" py="1" borderRadius="md" mb="3" style={{ 'background-color': 'rgba(48, 164, 108, 0.12)' }}>
        <span style={{ ...monoLabelStyle, color: '#30a46c', 'font-size': '0.625rem' }}>LOCAL FIRST</span>
      </Box>
      <p class={css({ fontSize: 'sm', lineHeight: 'relaxed' })} style={{ color: 'var(--on-surface-variant)' }}>
        Your notes live on your device. We don't read them, we don't track you.
      </p>
    </BentoCard>
  )
}

/* ================================================================
   Platform Card (1×1)
   ================================================================ */

function PlatformCard() {
  return (
    <BentoCard delay={0.4}>
      <Flex
        alignItems="center"
        justifyContent="center"
        w="10"
        h="10"
        borderRadius="lg"
        mb="5"
        color="#b0b4ba"
        style={{ 'border': '1px solid var(--surface-border)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </Flex>
      <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default', mb: '3' })}>Cross-Platform</h3>
      <Flex gap="2" mb="3" flexWrap="wrap">
        <For each={['macOS', 'Windows', 'Linux']}>
          {(os) => (
            <Box
              px="2.5"
              py="1"
              borderRadius="md"
              fontSize="xs"
              fontWeight="medium"
              style={{
                'background-color': 'var(--surface-high)',
                color: 'var(--on-surface-variant)',
              }}
            >
              {os}
            </Box>
          )}
        </For>
      </Flex>
      <p class={css({ fontSize: 'sm', lineHeight: 'relaxed' })} style={{ color: 'var(--on-surface-variant)' }}>
        Native feel on every platform you use.
      </p>
    </BentoCard>
  )
}

/* ================================================================
   Sync Card (1×2 tall)
   ================================================================ */

function SyncCard() {
  const reveal = createScrollReveal(0.5)

  return (
    <div
      ref={reveal}
      class={`${bentoCardClass} ${css({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      })}`}
      style={{
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
        'grid-row': 'span 2',
      }}
    >
      <Box>
        <Flex
          alignItems="center"
          justifyContent="center"
          w="10"
          h="10"
          borderRadius="lg"
          mb="5"
          color="#b0b4ba"
          style={{ 'border': '1px solid var(--surface-border)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
        </Flex>
        <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default', mb: '2' })}>Real-time Sync</h3>
        <p class={css({ fontSize: 'sm', lineHeight: 'relaxed', mb: '6' })} style={{ color: 'var(--on-surface-variant)' }}>
          Share notes with anyone. Collaborate in real-time with conflict-free editing powered by Yjs.
        </p>
      </Box>

      {/* Sync visual */}
      <Box borderRadius="lg" p="4" style={{ 'background-color': 'var(--surface-container)' }}>
        <Flex alignItems="center" justifyContent="center" gap="4">
          {/* Device 1 */}
          <Flex flexDirection="column" alignItems="center" gap="1.5">
            <Box
              w="8"
              h="8"
              borderRadius="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              style={{ 'background-color': 'var(--surface-high)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </Box>
            <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)', 'font-size': '0.5625rem' }}>DESKTOP</span>
          </Flex>

          {/* Sync arrows */}
          <Flex flexDirection="column" alignItems="center" gap="0.5">
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
              <path d="M0 6h20M16 2l4 4-4 4" stroke="#7a0d02" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
              <path d="M24 6H4M8 2L4 6l4 4" stroke="#7a0d02" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5" />
            </svg>
          </Flex>

          {/* Device 2 */}
          <Flex flexDirection="column" alignItems="center" gap="1.5">
            <Box
              w="8"
              h="8"
              borderRadius="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              style={{ 'background-color': 'var(--surface-high)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </Box>
            <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)', 'font-size': '0.5625rem' }}>MOBILE</span>
          </Flex>
        </Flex>
      </Box>
    </div>
  )
}

/* ================================================================
   Open Source Card (2×1 wide, with animated counters)
   ================================================================ */

function OpenSourceCard() {
  const reveal = createScrollReveal(0.6)

  return (
    <div
      ref={reveal}
      class={`${bentoCardClass}`}
      style={{
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
        'grid-column': 'span 2',
      }}
    >
      <Flex
        flexDirection={{ base: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        gap="6"
      >
        <Box>
          <Flex alignItems="center" gap="2" mb="3">
            <Box color="#b0b4ba">
              <GitHubIcon size={20} />
            </Box>
            <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default' })}>Open Source</h3>
          </Flex>
          <p class={css({ fontSize: 'sm', lineHeight: 'relaxed', mb: '4' })} style={{ color: 'var(--on-surface-variant)' }}>
            Transparent, community-driven, no vendor lock-in. Audit the code, contribute features, or self-host.
          </p>
          <a
            href="https://github.com/vygr-labs/noted-desktop-app"
            target="_blank"
            rel="noopener noreferrer"
            class={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              px: '4',
              py: '2',
              borderRadius: 'sm',
              color: 'fg.default',
              fontWeight: 'semibold',
              fontSize: 'sm',
              textDecoration: 'none',
              transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
              _hover: { transform: 'translateY(-1px)' },
            })}
            style={{ border: '1px solid var(--surface-border)' }}
          >
            <GitHubIcon size={16} />
            Star on GitHub
          </a>
        </Box>

        {/* Mini Terminal */}
        <Box
          borderRadius="lg"
          px="4"
          py="3"
          flexShrink={0}
          display={{ base: 'none', md: 'block' }}
          style={{
            'background-color': 'var(--surface-container)',
            border: '1px solid var(--surface-border)',
            'font-family': "'JetBrains Mono', monospace",
            'font-size': '0.75rem',
          }}
        >
          <p>
            <span style={{ color: '#7a0d02' }}>$ </span>
            <span style={{ color: 'var(--on-surface)' }}>git clone https://github.com/vygr-labs/noted-desktop-app</span>
          </p>
          <p style={{ 'margin-top': '0.25rem' }}>
            <span style={{ color: '#7a0d02' }}>$ </span>
            <span style={{ color: 'var(--on-surface)' }}>npm install && npm start</span>
          </p>
          <p style={{ 'margin-top': '0.25rem', color: 'var(--on-surface-variant)' }}>
            Editor ready <span style={{ color: '#30a46c' }}>&#10003;</span>
          </p>
        </Box>
      </Flex>
    </div>
  )
}

/* ================================================================
   CTA Card (full-width gradient bento card)
   ================================================================ */

function CtaCard() {
  const reveal = createScrollReveal(0.7)

  return (
    <div
      id="download"
      ref={reveal}
      class={`hero-cta-gradient ${css({
        borderRadius: 'sm',
        overflow: 'hidden',
        textAlign: 'center',
        px: { base: '6', md: '12', lg: '20' },
        py: { base: '12', md: '16', lg: '20' },
      })}`}
      style={{ 'grid-column': '1 / -1' }}
    >
      <h2
        class={css({
          fontSize: { base: '3xl', md: '5xl', lg: '6xl' },
          fontWeight: 'extrabold',
          letterSpacing: '-0.03em',
          color: 'white',
          mb: '6',
        })}
      >
        Ready to start noting?
      </h2>
      <p
        class={css({ maxW: 'xl', mx: 'auto', fontSize: 'lg', mb: '10', lineHeight: 'relaxed' })}
        style={{ color: 'rgba(255, 255, 255, 0.8)' }}
      >
        A distraction-free editor for writers, developers, and deep thinkers.
      </p>
      <Flex
        flexDirection={{ base: 'column', sm: 'row' }}
        alignItems="center"
        justifyContent="center"
        gap="4"
      >
        <a
          href="/download"
          class={css({
            w: { base: 'full', sm: 'auto' },
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3',
            px: '8',
            py: '4',
            borderRadius: 'sm',
            fontWeight: 'bold',
            fontSize: 'lg',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            _hover: { transform: 'translateY(-2px)' },
            _active: { transform: 'translateY(0)' },
          })}
          style={{ 'background-color': 'white', color: '#7a0d02' }}
        >
          <DownloadIcon />
          Get Noted for Desktop
        </a>
        <a
          href="https://github.com/vygr-labs/noted-desktop-app"
          target="_blank"
          rel="noopener noreferrer"
          class={css({
            w: { base: 'full', sm: 'auto' },
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            px: '8',
            py: '4',
            borderRadius: 'sm',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 'lg',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            _hover: { transform: 'translateY(-2px)' },
            _active: { transform: 'translateY(0)' },
          })}
          style={{ border: '1px solid rgba(255, 255, 255, 0.3)' }}
        >
          View on GitHub
        </a>
      </Flex>
    </div>
  )
}

/* ================================================================
   Footer Card (full-width bento card)
   ================================================================ */

function FooterCard() {
  return (
    <div
      class={css({
        borderRadius: 'sm',
        px: { base: '6', md: '8' },
        py: { base: '8', md: '10' },
      })}
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
          <span class={css({ fontSize: 'xl', fontWeight: 'bold', letterSpacing: '-0.05em', color: 'fg.default' })}>
            noted.
          </span>
          <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)' }}>
            &copy; 2026 noted. All rights reserved. Voyager Technologies
          </span>
        </Flex>

        <Flex gap="8">
          <For each={[{ label: 'Features', href: '#features' }, { label: 'Download', href: '/download' }, { label: 'GitHub', href: 'https://github.com/vygr-labs/noted-desktop-app' }]}>
            {(link) => (
              <a
                href={link.href}
                target={link.label === 'GitHub' ? '_blank' : undefined}
                rel={link.label === 'GitHub' ? 'noopener noreferrer' : undefined}
                style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)', 'text-decoration': 'none', transition: 'color 0.3s' }}
                class={css({ _hover: { color: 'fg.default' } })}
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

/* ================================================================
   Page
   ================================================================ */

export default function Home() {
  return (
    <>
      <Nav />
      <main style={{ 'background-color': 'var(--surface-dim)' }}>
        <div
          class={css({
            display: 'grid',
            gap: '5',
            gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            maxW: '7xl',
            mx: 'auto',
            px: '6',
            pt: '24',
            pb: { base: '12', lg: '20' },
          })}
        >
          <HeroCard />
          <ThemeCard />
          <EditorCard />
          <SpeedCard />
          <PrivacyCard />
          <PlatformCard />
          <SyncCard />
          <OpenSourceCard />
          <CtaCard />
          <FooterCard />
        </div>
      </main>
    </>
  )
}
