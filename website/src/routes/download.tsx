import { css } from 'styled-system/css'
import { Box, Flex } from 'styled-system/jsx'
import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { useSearchParams } from '@solidjs/router'
import { Layout } from '~/components/Layout'
import { FooterCard, GitHubIcon, monoLabelStyle } from '~/components/shared'

/* ================================================================
   Hooks
   ================================================================ */

function createStaggerReveal(count: number, staggerMs = 100) {
  const refs: HTMLElement[] = []
  const timeouts: number[] = []

  onMount(() => {
    const startTimeout = window.setTimeout(() => {
      refs.forEach((el, i) => {
        if (el) {
          const t = window.setTimeout(() => {
            el.classList.add('bento-revealed')
          }, i * staggerMs)
          timeouts.push(t)
        }
      })
    }, 50)
    onCleanup(() => {
      clearTimeout(startTimeout)
      timeouts.forEach(clearTimeout)
    })
  })

  return (index: number) => (el: HTMLElement) => {
    el.classList.add('bento-reveal')
    refs[index] = el
  }
}

/* ================================================================
   Shared Styles
   ================================================================ */

const cardStyle = {
  'background-color': 'var(--surface-low)',
  border: '1px solid var(--surface-border)',
} as const

/* ================================================================
   Platform Icons
   ================================================================ */

function WindowsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function LinuxIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.311.01-.465.035-.637.085-1.199.369-1.64.817-.447.451-.759.99-.923 1.559-.152.548-.18 1.088-.08 1.597.086.42.255.864.505 1.325l.03.057c.237.442.49.899.718 1.373.221.46.405.932.505 1.398.083.385.088.782-.009 1.18-.084.342-.225.672-.413.985a7.463 7.463 0 0 0-.474.848 5.618 5.618 0 0 0-.345.95c-.103.382-.141.78-.112 1.186.038.514.156 1.026.349 1.526.189.485.448.95.774 1.374.17.22.364.424.573.609.205.18.423.34.65.48.438.268.912.453 1.396.545.49.091.986.082 1.47-.028.495-.112.966-.323 1.378-.614a4.36 4.36 0 0 0 .577-.486c.206-.196.394-.41.562-.636.335-.456.592-.958.76-1.488.164-.516.247-1.058.245-1.604-.001-.518-.084-1.04-.248-1.545a7.497 7.497 0 0 0-.427-1.057 12.213 12.213 0 0 0-.456-.822c-.167-.274-.35-.557-.504-.84a6.985 6.985 0 0 1-.455-1.006c-.129-.401-.183-.81-.145-1.218.03-.318.116-.64.26-.946.15-.321.361-.622.627-.884.258-.253.568-.46.909-.61.34-.148.705-.238 1.078-.262.372-.023.749.023 1.113.136.377.117.735.305 1.049.557.32.256.595.579.803.945.211.372.348.788.401 1.222.054.439.019.897-.106 1.335-.12.42-.316.82-.577 1.175a4.708 4.708 0 0 1-.493.562c.373.23.717.508 1.02.828.304.322.562.693.758 1.1.196.408.326.85.382 1.31.053.438.03.888-.069 1.324-.096.42-.258.824-.479 1.197-.222.374-.5.714-.827 1.002a5.336 5.336 0 0 1-1.087.76c-.416.225-.863.393-1.328.498-.471.106-.958.148-1.444.125a6.279 6.279 0 0 1-1.408-.213 7.544 7.544 0 0 1-1.33-.498 9.386 9.386 0 0 1-1.215-.7c-.38-.255-.738-.54-1.063-.854a7.152 7.152 0 0 1-.871-.966 5.986 5.986 0 0 1-.65-1.119 5.097 5.097 0 0 1-.377-1.236 5.092 5.092 0 0 1-.059-1.284c.04-.429.142-.851.303-1.252.16-.398.378-.772.647-1.108.133-.166.28-.323.438-.467-.12-.275-.213-.564-.278-.86a4.751 4.751 0 0 1-.078-1.108c.018-.378.085-.752.2-1.112.115-.358.277-.7.484-1.012.207-.313.46-.596.75-.838.288-.24.612-.437.963-.583.35-.146.726-.239 1.114-.276.389-.036.787-.013 1.176.07z" />
    </svg>
  )
}

/* ================================================================
   Hero Card
   ================================================================ */

function HeroCard(props: { autoStarted?: boolean; platformName?: string }) {
  return (
    <div
      class={`animate-fade-in-up ${css({
        textAlign: 'center',
        px: { base: '6', md: '8', lg: '12' },
        py: { base: '10', md: '12', lg: '14' },
        borderRadius: 'sm',
        overflow: 'hidden',
      })}`}
      style={{
        'grid-column': '1 / -1',
        ...cardStyle,
      }}
    >
      <h1
        class={`hero-gradient-text ${css({
          fontSize: { base: '3xl', md: '5xl', lg: '6xl' },
          fontWeight: 'extrabold',
          letterSpacing: '-0.04em',
          lineHeight: { base: '1.05', lg: '0.95' },
          mb: '4',
        })}`}
      >
        {props.autoStarted ? 'Your download has started.' : 'Download noted.'}
      </h1>
      <p
        class={css({
          maxW: 'lg',
          mx: 'auto',
          fontSize: { base: 'md', lg: 'lg' },
          lineHeight: 'relaxed',
        })}
        style={{ color: 'var(--on-surface-variant)' }}
      >
        {props.autoStarted
          ? `noted. for ${props.platformName} is downloading. If it didn\u2019t start, pick your platform below.`
          : 'Available on macOS, Windows, and Linux. Free and open source, forever.'}
      </p>
    </div>
  )
}

/* ================================================================
   Platform Download Cards
   ================================================================ */

const RELEASE_BASE = 'https://github.com/vygr-labs/noted-desktop-app/releases/latest/download'

const platforms = [
  {
    name: 'Windows',
    icon: () => <WindowsIcon />,
    file: 'noted-win-x64.exe',
    requirement: 'Windows 10 or later',
  },
  {
    name: 'macOS',
    icon: () => <AppleIcon />,
    file: 'noted-mac-arm64.dmg',
    requirement: 'macOS 12 Monterey or later',
  },
  {
    name: 'Linux (AppImage)',
    icon: () => <LinuxIcon />,
    file: 'noted-linux-x64.AppImage',
    requirement: 'Any modern Linux distro',
  },
  {
    name: 'Linux (Debian)',
    icon: () => <LinuxIcon />,
    file: 'noted-linux-x64.deb',
    requirement: 'Ubuntu, Debian, Mint, Pop!_OS',
  },
  {
    name: 'Linux (RPM)',
    icon: () => <LinuxIcon />,
    file: 'noted-linux-x64.rpm',
    requirement: 'Fedora, RHEL, openSUSE',
  },
  {
    name: 'Linux (Snap)',
    icon: () => <LinuxIcon />,
    file: 'noted-linux-x64.snap',
    requirement: 'Any distro with Snapd',
  },
]

function PlatformCard(props: { platform: typeof platforms[0]; staggerRef?: (el: HTMLElement) => void }) {
  return (
    <div
      ref={props.staggerRef}
      data-stagger=""
      class={css({
        p: { base: '6', lg: '8' },
        borderRadius: 'sm',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '5',
        transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        _hover: { transform: 'translateY(-4px)' },
      })}
      style={cardStyle}
    >
      {/* Icon */}
      <Flex
        alignItems="center"
        justifyContent="center"
        w="14"
        h="14"
        borderRadius="lg"
        color="#b0b4ba"
        style={{ border: '1px solid var(--surface-border)' }}
      >
        {props.platform.icon()}
      </Flex>

      {/* Name */}
      <h3 class={css({ fontSize: 'xl', fontWeight: 'bold', color: 'fg.default' })}>
        {props.platform.name}
      </h3>

      {/* File info */}
      <p style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)' }}>
        {props.platform.file}
      </p>

      {/* Requirement */}
      <p class={css({ fontSize: 'xs', lineHeight: 'relaxed' })} style={{ color: 'var(--on-surface-variant)' }}>
        {props.platform.requirement}
      </p>

      {/* Download Button */}
      <a
        href={`${RELEASE_BASE}/${props.platform.file}`}
        class={css({
          w: 'full',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2',
          px: '6',
          py: '3',
          borderRadius: 'sm',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 'sm',
          textDecoration: 'none',
          transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
          _hover: { transform: 'translateY(-1px)' },
          _active: { transform: 'translateY(0)' },
        })}
        style={{ 'background-color': '#7a0d02' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download for {props.platform.name}
      </a>
    </div>
  )
}

/* ================================================================
   Version Info Card (wide)
   ================================================================ */

function VersionCard(props: { staggerRef?: (el: HTMLElement) => void }) {
  return (
    <div
      ref={props.staggerRef}
      data-stagger=""
      class={css({
        p: { base: '6', lg: '8' },
        borderRadius: 'sm',
        overflow: 'hidden',
      })}
      style={{
        'grid-column': 'span 2',
        ...cardStyle,
      }}
    >
      <Flex
        flexDirection={{ base: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'center' }}
        gap="6"
      >
        <Box>
          <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default', mb: '2' })}>
            Latest Release
          </h3>
          <Flex alignItems="center" gap="3" mb="3">
            <Box
              px="2"
              py="0.5"
              borderRadius="sm"
              style={{ 'background-color': 'rgba(48, 164, 108, 0.12)' }}
            >
              <span style={{ ...monoLabelStyle, color: '#30a46c', 'font-size': '0.625rem' }}>STABLE</span>
            </Box>
            <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)' }}>
              v1.0.0
            </span>
          </Flex>
          <p class={css({ fontSize: 'sm', lineHeight: 'relaxed' })} style={{ color: 'var(--on-surface-variant)' }}>
            Rich text editing, real-time sync, built-in todos, 4 themes, and cross-platform support.
          </p>
        </Box>

        <Flex gap="3" flexShrink={0}>
          <a
            href="https://github.com/vygr-labs/noted-desktop-app"
            target="_blank"
            rel="noopener noreferrer"
            class={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              px: '5',
              py: '2.5',
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
            View Changelog
          </a>
        </Flex>
      </Flex>
    </div>
  )
}

/* ================================================================
   Source Card
   ================================================================ */

function SourceCard(props: { staggerRef?: (el: HTMLElement) => void }) {
  return (
    <div
      ref={props.staggerRef}
      data-stagger=""
      class={css({
        p: { base: '6', lg: '8' },
        borderRadius: 'sm',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      })}
      style={cardStyle}
    >
      <Box>
        <Flex alignItems="center" gap="2" mb="3">
          <Box color="#b0b4ba">
            <GitHubIcon size={20} />
          </Box>
          <h3 class={css({ fontSize: 'lg', fontWeight: 'bold', color: 'fg.default' })}>Build from Source</h3>
        </Flex>
        <p class={css({ fontSize: 'sm', lineHeight: 'relaxed', mb: '4' })} style={{ color: 'var(--on-surface-variant)' }}>
          Clone the repo and build it yourself. Full control, full transparency.
        </p>
      </Box>

      <Box
        borderRadius="lg"
        px="4"
        py="3"
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
          <span style={{ color: 'var(--on-surface)' }}>npm install && npm run build</span>
        </p>
      </Box>
    </div>
  )
}

/* ================================================================
   Page
   ================================================================ */

function detectPlatform(): { file: string; name: string } | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return { file: 'noted-win-x64.exe', name: 'Windows' }
  if (ua.includes('mac')) return { file: 'noted-mac-arm64.dmg', name: 'macOS' }
  if (ua.includes('linux')) return { file: 'noted-linux-x64.AppImage', name: 'Linux' }
  return null
}

export default function Download() {
  const [params] = useSearchParams()
  const stagger = createStaggerReveal(9, 80)
  const [autoStarted, setAutoStarted] = createSignal(false)
  const [platformName, setPlatformName] = createSignal('')

  onMount(() => {
    window.scrollTo(0, 0)

    if (params.auto !== undefined) {
      const platform = detectPlatform()
      if (platform) {
        setPlatformName(platform.name)
        setAutoStarted(true)
        window.location.href = `${RELEASE_BASE}/${platform.file}`
      }
    }
  })

  return (
    <Layout>
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
        <HeroCard autoStarted={autoStarted()} platformName={platformName()} />
        <For each={platforms}>
          {(platform, i) => <PlatformCard platform={platform} staggerRef={stagger(i())} />}
        </For>
        <VersionCard staggerRef={stagger(6)} />
        <SourceCard staggerRef={stagger(7)} />
        <FooterCard staggerRef={stagger(8)} />
      </div>
    </Layout>
  )
}
