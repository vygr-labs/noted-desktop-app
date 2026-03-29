import { css } from 'styled-system/css'
import { Box, Container, Flex, Grid } from 'styled-system/jsx'

/* ================================================================
   Shared Styles
   ================================================================ */

const navLinkClass = css({
  fontSize: 'sm',
  fontWeight: 'medium',
  color: 'fg.muted',
  textDecoration: 'none',
  transition: 'color 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
  _hover: { color: 'flame.9' },
})

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
      })}
      style={{
        'background-color': 'var(--nav-bg)',
        'border-bottom': '1px solid var(--surface-border)',
      }}
    >
      <Box maxW="7xl" mx="auto" px="6">
        <Flex justifyContent="space-between" alignItems="center" py="4">
          {/* Left: Logo + Links */}
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
            <Flex
              display={{ base: 'none', md: 'flex' }}
              alignItems="center"
              gap="6"
            >
              <a href="#features" class={navLinkClass}>Features</a>
              <a href="#download" class={navLinkClass}>Download</a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                class={navLinkClass}
              >
                GitHub
              </a>
            </Flex>
          </Flex>

          {/* Right: CTA */}
          <Flex alignItems="center" gap="4">
            <a
              href="#download"
              class={`hero-cta-gradient ${css({
                display: 'inline-flex',
                alignItems: 'center',
                px: '5',
                py: '2',
                borderRadius: 'full',
                color: 'white',
                fontWeight: 'semibold',
                fontSize: 'sm',
                textDecoration: 'none',
                transition: 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
                _active: { transform: 'scale(0.95)' },
              })}`}
              style={{ 'box-shadow': '0 4px 14px rgba(206, 33, 0, 0.2)' }}
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
   Hero Section
   ================================================================ */

function Hero() {
  return (
    <Box as="section" maxW="7xl" mx="auto" px="6" textAlign="center" mb={{ base: '20', lg: '32' }}>
      {/* Open Source Badge */}
      <Box class="animate-fade-in-up" mb="8">
        <Flex
          display="inline-flex"
          alignItems="center"
          gap="2"
          px="3"
          py="1.5"
          borderRadius="full"
          style={{
            'background-color': 'var(--surface-high)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <Box color="flame.9" flexShrink={0}>
            <TerminalIcon />
          </Box>
          <span
            style={{
              'font-family': "'JetBrains Mono', monospace",
              'font-size': '10px',
              'text-transform': 'uppercase',
              'letter-spacing': '0.1em',
              color: '#ff690a',
            }}
          >
            Open Source &amp; Local First
          </span>
        </Flex>
      </Box>

      {/* Headline */}
      <h1
        class={`hero-gradient-text animate-fade-in-up ${css({
          fontSize: { base: '4xl', md: '6xl', lg: '8xl' },
          fontWeight: 'extrabold',
          letterSpacing: '-0.04em',
          lineHeight: { base: '1', lg: '0.9' },
          mb: '8',
        })}`}
      >
        Your thoughts,
        <br />
        beautifully noted.
      </h1>

      {/* Subtitle */}
      <p
        class={`animate-fade-in-up-delay-1 ${css({
          maxW: '2xl',
          mx: 'auto',
          fontSize: { base: 'md', md: 'lg', lg: 'xl' },
          lineHeight: 'relaxed',
          mb: '12',
        })}`}
        style={{ color: 'var(--on-surface-variant)' }}
      >
        The minimalist editor for deep thinkers. Experience a clutter-free
        environment designed to turn complex ideas into structured knowledge.
      </p>

      {/* CTAs */}
      <Flex
        flexDirection={{ base: 'column', sm: 'row' }}
        alignItems="center"
        justifyContent="center"
        gap="4"
        mb={{ base: '14', lg: '20' }}
        class="animate-fade-in-up-delay-2"
      >
        <a
          href="#download"
          class={`hero-cta-gradient ${css({
            w: { base: 'full', sm: 'auto' },
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: '8',
            py: '4',
            borderRadius: 'full',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 'lg',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            _hover: { transform: 'translateY(-2px)' },
            _active: { transform: 'translateY(0)' },
          })}`}
          style={{ 'box-shadow': '0 8px 24px rgba(206, 33, 0, 0.25)' }}
        >
          Download Free
        </a>
        <a
          href="https://github.com"
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
            borderRadius: 'full',
            color: 'fg.default',
            fontWeight: 'bold',
            fontSize: 'lg',
            textDecoration: 'none',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
            _hover: { transform: 'translateY(-2px)' },
            _active: { transform: 'translateY(0)' },
          })}
          style={{
            border: '1px solid rgba(93, 64, 58, 0.3)',
          }}
        >
          <StarIcon />
          Star on GitHub
        </a>
      </Flex>

      {/* App Mockup with Glow */}
      <Box position="relative" class="animate-fade-in-up-delay-3">
        {/* Orange glow behind mockup */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            background: 'rgba(234, 88, 12, var(--glow-opacity))',
            filter: 'blur(120px)',
            'border-radius': '9999px',
            'z-index': '0',
            'pointer-events': 'none',
          }}
        />
        <AppMockup />
      </Box>
    </Box>
  )
}

/* ================================================================
   App Mockup
   ================================================================ */

function AppMockup() {
  return (
    <Box
      position="relative"
      zIndex={1}
      borderRadius="xl"
      overflow="hidden"
      p="1"
      mx="auto"
      maxW="5xl"
      style={{
        'background-color': 'var(--surface-low)',
        border: '1px solid var(--surface-border)',
        'box-shadow': '0 24px 48px rgba(0, 0, 0, 0.2)',
      }}
    >
      <Box
        borderRadius="lg"
        overflow="hidden"
        position="relative"
        style={{ 'background-color': 'var(--surface-dim)' }}
      >
        {/* Title bar */}
        <Flex
          alignItems="center"
          gap="2"
          px="4"
          py="3"
          style={{ 'background-color': 'var(--surface-container)' }}
        >
          <Box w="3" h="3" borderRadius="full" style={{ background: 'rgba(255, 95, 87, 0.5)' }} />
          <Box w="3" h="3" borderRadius="full" style={{ background: 'rgba(254, 188, 46, 0.5)' }} />
          <Box w="3" h="3" borderRadius="full" style={{ background: 'rgba(40, 200, 64, 0.5)' }} />
          <Box flex="1" />
          <span
            class={css({
              fontSize: 'xs',
              color: 'fg.subtle',
              fontWeight: 'medium',
            })}
          >
            noted.
          </span>
        </Flex>

        {/* Gradient accent line */}
        <Box
          h="0.5"
          style={{
            background: 'linear-gradient(90deg, #ff690a, #ce2100, #420004)',
          }}
        />

        {/* Editor content */}
        <Box p={{ base: '5', md: '8' }} pb={{ base: '8', md: '12' }}>
          <Box mb="6">
            <Box
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="bold"
              color="fg.default"
              mb="3"
            >
              Meeting Notes
            </Box>
            <Box
              h="2px"
              w="10"
              mb="4"
              borderRadius="full"
              style={{
                background: 'linear-gradient(90deg, #ff690a, #ce2100)',
              }}
            />
          </Box>

          <p
            class={css({
              fontSize: 'sm',
              color: 'fg.default',
              mb: '3',
              lineHeight: 'relaxed',
            })}
          >
            Discussed the new <strong>product roadmap</strong> for Q2. Key
            takeaways from the team:
          </p>

          <Box as="ul" pl="5" mb="5">
            {['Prioritize mobile experience', 'Launch sync feature by March', 'Improve search performance'].map(
              (item) => (
                <li
                  class={css({
                    fontSize: 'sm',
                    color: 'fg.default',
                    mb: '1.5',
                    lineHeight: 'relaxed',
                  })}
                >
                  {item}
                </li>
              ),
            )}
          </Box>

          <Box pl="4" borderLeft="3px solid" borderColor="flame.7">
            <p
              class={css({
                fontSize: 'sm',
                color: 'fg.muted',
                fontStyle: 'italic',
                lineHeight: 'relaxed',
              })}
            >
              "The best note-taking app is the one you actually enjoy using."
            </p>
          </Box>
        </Box>

        {/* Bottom fade overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '80px',
            background: 'linear-gradient(to top, var(--surface-dim), transparent)',
            'pointer-events': 'none',
          }}
        />
      </Box>
    </Box>
  )
}

/* ================================================================
   Features Section
   ================================================================ */

function Features() {
  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      title: 'Rich Text Editor',
      description: 'Markdown support that feels invisible. Focus on your words, we handle the formatting.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
      ),
      title: 'Real-time Sync',
      description: 'End-to-end encrypted synchronization across all your devices, instantaneously.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      title: 'Lightning Fast',
      description: 'Built with performance in mind. No loading states, just pure, unadulterated speed.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r="2.5" />
          <path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5z" />
          <path d="M2 12h4l2.5 3L12 9l3 6h7" />
        </svg>
      ),
      title: 'Beautiful Themes',
      description: 'A curated collection of editorial themes designed for day and night writing sessions.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: 'Cross-Platform',
      description: 'Native apps for macOS, Windows, and Linux. Your notes, everywhere.',
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      title: 'Privacy First',
      description: "Local-first storage. We don't read your notes, we don't track your thoughts.",
    },
  ]

  return (
    <Box as="section" id="features" maxW="7xl" mx="auto" px="6" py={{ base: '16', lg: '24' }} mb={{ base: '8', lg: '24' }}>
      {/* Heading */}
      <Box mb="16" textAlign={{ base: 'center', md: 'left' }}>
        <h2
          class={css({
            fontSize: { base: '3xl', md: '4xl', lg: '5xl' },
            fontWeight: 'bold',
            letterSpacing: '-0.03em',
            color: 'fg.default',
            mb: '4',
          })}
        >
          Precision Crafted.
        </h2>
        <p
          class={css({
            fontSize: 'lg',
            maxW: 'xl',
          })}
          style={{ color: 'var(--on-surface-variant)' }}
        >
          Every feature is designed to reduce friction and amplify your cognitive workflow.
        </p>
      </Box>

      {/* Cards Grid */}
      <Grid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
        {features.map((feature) => (
          <Box
            p="8"
            borderRadius="xl"
            cursor="default"
            transition="all 0.3s cubic-bezier(0.23, 1, 0.32, 1)"
            class={css({
              _hover: {
                transform: 'translateY(-2px)',
              },
            })}
            style={{
              'background-color': 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
            }}
          >
            {/* Icon */}
            <Flex
              alignItems="center"
              justifyContent="center"
              w="12"
              h="12"
              borderRadius="lg"
              mb="6"
              color="flame.9"
              style={{ 'background-color': 'rgba(255, 105, 10, 0.1)' }}
            >
              {feature.icon}
            </Flex>

            <h3
              class={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: 'fg.default',
                mb: '3',
              })}
            >
              {feature.title}
            </h3>
            <p
              class={css({
                fontSize: 'sm',
                lineHeight: 'relaxed',
              })}
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {feature.description}
            </p>
          </Box>
        ))}
      </Grid>
    </Box>
  )
}

/* ================================================================
   Open Source Section
   ================================================================ */

function OpenSource() {
  return (
    <Box
      as="section"
      py={{ base: '20', lg: '32' }}
      style={{
        'background-color': 'var(--surface-low)',
        'border-top': '1px solid var(--surface-border)',
        'border-bottom': '1px solid var(--surface-border)',
      }}
    >
      <Box maxW="7xl" mx="auto" px="6">
        <Flex
          flexDirection={{ base: 'column', md: 'row' }}
          alignItems="center"
          justifyContent="space-between"
          gap="12"
        >
          {/* Text Side */}
          <Box w={{ base: 'full', md: '1/2' }}>
            <h2
              class={css({
                fontSize: { base: '3xl', md: '4xl', lg: '5xl' },
                fontWeight: 'bold',
                letterSpacing: '-0.03em',
                color: 'fg.default',
                mb: '6',
              })}
            >
              Open source,
              <br />
              open future.
            </h2>
            <p
              class={css({
                fontSize: 'lg',
                lineHeight: 'relaxed',
                mb: '8',
              })}
              style={{ color: 'var(--on-surface-variant)' }}
            >
              We believe tools for thought should be transparent and accessible.
              noted. is built by the community, for the community. Audit the
              code, contribute features, or host your own sync server.
            </p>

            {/* Stats */}
            <Flex alignItems="center" gap="6">
              <Box>
                <Box fontSize="2xl" fontWeight="bold" color="fg.default">
                  14.2k
                </Box>
                <span
                  style={{
                    'font-family': "'JetBrains Mono', monospace",
                    'font-size': '0.6875rem',
                    'text-transform': 'uppercase',
                    'letter-spacing': '0.1em',
                    color: 'var(--on-surface-variant)',
                  }}
                >
                  Stars on GitHub
                </span>
              </Box>
              <Box
                h="10"
                w="1px"
                style={{ 'background-color': 'var(--surface-border)' }}
              />
              <Box>
                <Box fontSize="2xl" fontWeight="bold" color="fg.default">
                  800+
                </Box>
                <span
                  style={{
                    'font-family': "'JetBrains Mono', monospace",
                    'font-size': '0.6875rem',
                    'text-transform': 'uppercase',
                    'letter-spacing': '0.1em',
                    color: 'var(--on-surface-variant)',
                  }}
                >
                  Contributors
                </span>
              </Box>
            </Flex>
          </Box>

          {/* Terminal Mockup */}
          <Box w={{ base: 'full', md: '1/2' }}>
            <Box
              p="6"
              borderRadius="xl"
              style={{
                'background-color': 'var(--surface-container)',
                border: '1px solid var(--surface-border)',
                'font-family': "'JetBrains Mono', monospace",
                'font-size': '0.875rem',
              }}
            >
              {/* Traffic lights */}
              <Flex alignItems="center" gap="2" mb="4">
                <Box w="3" h="3" borderRadius="full" style={{ background: 'rgba(255, 95, 87, 0.5)' }} />
                <Box w="3" h="3" borderRadius="full" style={{ background: 'rgba(254, 188, 46, 0.5)' }} />
                <Box w="3" h="3" borderRadius="full" style={{ background: 'rgba(40, 200, 64, 0.5)' }} />
              </Flex>

              {/* Terminal lines */}
              <Flex flexDirection="column" gap="1">
                <p>
                  <span style={{ color: '#ff690a' }}>git </span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>clone</span>
                  <span style={{ color: 'var(--on-surface)' }}> https://github.com/voyager/noted</span>
                </p>
                <p>
                  <span style={{ color: '#ff690a' }}>cd </span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>noted</span>
                </p>
                <p>
                  <span style={{ color: '#ff690a' }}>npm </span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>install</span>
                </p>
                <p>
                  <span style={{ color: '#ff690a' }}>npm </span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>run start</span>
                </p>
                <p style={{ 'padding-top': '0.5rem', color: 'var(--on-surface-variant)' }}>
                  // Welcome to the workspace
                </p>
                <p style={{ color: 'var(--on-surface)' }}>
                  Initializing editor engine...{' '}
                  <span style={{ color: '#30a46c' }}>Ready</span>
                </p>
              </Flex>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  )
}

/* ================================================================
   CTA Section
   ================================================================ */

function CallToAction() {
  return (
    <Box as="section" id="download" maxW="7xl" mx="auto" px="6" py={{ base: '20', lg: '32' }}>
      <Box
        position="relative"
        borderRadius="2xl"
        overflow="hidden"
        textAlign="center"
        px={{ base: '6', md: '12', lg: '24' }}
        py={{ base: '12', md: '16', lg: '24' }}
        class="hero-cta-gradient"
      >
        <Box position="relative" zIndex={1}>
          <h2
            class={css({
              fontSize: { base: '3xl', md: '5xl', lg: '7xl' },
              fontWeight: 'extrabold',
              letterSpacing: '-0.03em',
              color: 'white',
              mb: '8',
            })}
          >
            Ready to start noting?
          </h2>
          <p
            class={css({
              maxW: 'xl',
              mx: 'auto',
              fontSize: 'lg',
              mb: '12',
              lineHeight: 'relaxed',
            })}
            style={{ color: 'rgba(255, 255, 255, 0.8)' }}
          >
            Join thousands of writers and thinkers who have found their focus.
          </p>

          <Flex
            flexDirection={{ base: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="center"
            gap="4"
          >
            <a
              href="#"
              class={css({
                w: { base: 'full', sm: 'auto' },
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3',
                px: '10',
                py: '5',
                borderRadius: 'full',
                fontWeight: 'bold',
                fontSize: 'xl',
                textDecoration: 'none',
                transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                _hover: { transform: 'translateY(-2px)' },
                _active: { transform: 'translateY(0)' },
              })}
              style={{
                'background-color': 'white',
                color: '#ce2100',
              }}
            >
              <DownloadIcon />
              Get Noted for Desktop
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              class={css({
                w: { base: 'full', sm: 'auto' },
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2',
                px: '10',
                py: '5',
                borderRadius: 'full',
                color: 'white',
                fontWeight: 'bold',
                fontSize: 'xl',
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
        </Box>
      </Box>
    </Box>
  )
}

/* ================================================================
   Footer
   ================================================================ */

function Footer() {
  return (
    <Box
      as="footer"
      px="8"
      py="12"
      style={{
        'background-color': 'var(--surface-dim)',
        'border-top': '1px solid var(--surface-border)',
      }}
    >
      <Flex
        maxW="7xl"
        mx="auto"
        flexDirection={{ base: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems="center"
        gap="8"
      >
        {/* Logo + Copyright */}
        <Flex
          flexDirection="column"
          alignItems={{ base: 'center', md: 'flex-start' }}
          gap="4"
        >
          <span
            class={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              letterSpacing: '-0.05em',
              color: 'fg.default',
            })}
          >
            noted.
          </span>
          <span
            style={{
              'font-family': "'JetBrains Mono', monospace",
              'font-size': '0.6875rem',
              'text-transform': 'uppercase',
              'letter-spacing': '0.1em',
              color: 'var(--on-surface-variant)',
            }}
          >
            &copy; 2026 noted. All rights reserved. Voyager Technologies
          </span>
        </Flex>

        {/* Links */}
        <Flex gap="8">
          {['Features', 'Download', 'GitHub'].map((label) => (
            <a
              href={label === 'GitHub' ? 'https://github.com' : `#${label.toLowerCase()}`}
              target={label === 'GitHub' ? '_blank' : undefined}
              rel={label === 'GitHub' ? 'noopener noreferrer' : undefined}
              style={{
                'font-family': "'JetBrains Mono', monospace",
                'font-size': '0.6875rem',
                'text-transform': 'uppercase',
                'letter-spacing': '0.1em',
                color: 'var(--on-surface-variant)',
                'text-decoration': 'none',
                transition: 'color 0.3s',
              }}
              class={css({ _hover: { color: 'fg.default' } })}
            >
              {label}
            </a>
          ))}
        </Flex>

        {/* Social Icons */}
        <Flex alignItems="center" gap="4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            class={css({
              color: 'fg.subtle',
              transition: 'color 0.3s',
              _hover: { color: 'flame.9' },
            })}
          >
            <GitHubIcon />
          </a>
          <a
            href="#"
            class={css({
              color: 'fg.subtle',
              transition: 'color 0.3s',
              _hover: { color: 'flame.9' },
            })}
          >
            <TerminalIcon />
          </a>
        </Flex>
      </Flex>
    </Box>
  )
}

/* ================================================================
   Page
   ================================================================ */

export default function Home() {
  return (
    <>
      <Nav />
      <main
        class={css({ pt: '32' })}
        style={{ 'background-color': 'var(--surface-dim)' }}
      >
        <Hero />
        <Features />
        <OpenSource />
        <CallToAction />
      </main>
      <Footer />
    </>
  )
}
