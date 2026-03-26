import { css } from 'styled-system/css'
import { Box, Container, Flex, Grid } from 'styled-system/jsx'
import { Button } from '~/components/ui/button'
import { createSignal, onMount } from 'solid-js'

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
        w: '9',
        h: '9',
        borderRadius: 'full',
        bg: 'gray.a3',
        cursor: 'pointer',
        border: 'none',
        color: 'fg.default',
        transition: 'all 0.2s',
        _hover: { bg: 'gray.a4' },
      })}
    >
      {dark() ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
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
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
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
        top: '0',
        left: '0',
        right: '0',
        zIndex: 'sticky',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: 'gray.a3',
      })}
      style={{ 'background-color': 'var(--nav-bg)' }}
    >
      <Container maxW="7xl" px={{ base: '4', md: '6' }}>
        <Flex justifyContent="space-between" alignItems="center" h="16">
          <a href="/" class={css({ display: 'flex', alignItems: 'center' })}>
            <img
              src="/noted-logo.svg"
              alt="noted."
              class={css({ h: '7' })}
            />
          </a>

          <Flex alignItems="center" gap={{ base: '3', md: '6' }}>
            <a
              href="#features"
              class={css({
                display: { base: 'none', md: 'block' },
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'fg.muted',
                textDecoration: 'none',
                transition: 'color 0.2s',
                _hover: { color: 'fg.default' },
              })}
            >
              Features
            </a>
            <a
              href="#download"
              class={css({
                display: { base: 'none', md: 'block' },
                fontSize: 'sm',
                fontWeight: 'medium',
                color: 'fg.muted',
                textDecoration: 'none',
                transition: 'color 0.2s',
                _hover: { color: 'fg.default' },
              })}
            >
              Download
            </a>
            <ThemeToggle />
            <Button colorPalette="flame" size="sm">
              Get Started
            </Button>
          </Flex>
        </Flex>
      </Container>
    </nav>
  )
}

/* ================================================================
   Hero Section
   ================================================================ */

function Hero() {
  return (
    <Box as="section" position="relative" overflow="hidden" pt={{ base: '28', lg: '36' }} pb={{ base: '16', lg: '24' }}>
      {/* Decorative gradient blobs */}
      <div
        class={css({ position: 'absolute', pointerEvents: 'none' })}
        style={{
          top: '-200px',
          right: '-100px',
          width: '700px',
          height: '700px',
          background:
            'radial-gradient(circle, rgba(255,105,10,0.1) 0%, rgba(206,33,0,0.05) 40%, transparent 70%)',
          'border-radius': '50%',
          filter: 'blur(60px)',
        }}
      />
      <div
        class={css({ position: 'absolute', pointerEvents: 'none' })}
        style={{
          bottom: '-300px',
          left: '-200px',
          width: '600px',
          height: '600px',
          background:
            'radial-gradient(circle, rgba(206,33,0,0.06) 0%, transparent 70%)',
          'border-radius': '50%',
          filter: 'blur(80px)',
        }}
      />

      <Container maxW="7xl" px={{ base: '4', md: '6' }} position="relative">
        <Grid
          columns={{ base: 1, lg: 2 }}
          gap={{ base: '12', lg: '16' }}
          alignItems="center"
        >
          {/* Text Content */}
          <Box class="animate-fade-in-up">
            <h1
              class={css({
                fontSize: { base: '4xl', md: '5xl', lg: '6xl' },
                fontWeight: 'extrabold',
                lineHeight: 'tight',
                letterSpacing: '-0.02em',
              })}
            >
              <span class="gradient-text">Your thoughts,</span>
              <br />
              <span class="gradient-text">beautifully noted.</span>
            </h1>

            <p
              class={`${css({
                fontSize: { base: 'md', lg: 'lg' },
                color: 'fg.muted',
                lineHeight: 'relaxed',
                mt: '6',
                maxW: 'xl',
              })} animate-fade-in-up-delay-1`}
            >
              A modern, lightning-fast note-taking app designed for the way you
              think. Rich text editing, seamless sync, and a beautiful interface
              — all in one place.
            </p>

            <Flex gap="4" mt="8" flexWrap="wrap" class="animate-fade-in-up-delay-2">
              <a
                href="#download"
                class={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  h: '12',
                  px: '8',
                  borderRadius: 'l2',
                  fontWeight: 'semibold',
                  fontSize: 'md',
                  color: 'white',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  _hover: {
                    opacity: '0.92',
                    transform: 'translateY(-1px)',
                  },
                  _active: { transform: 'translateY(0)' },
                })}
                style={{
                  background:
                    'linear-gradient(135deg, #ff690a 0%, #ce2100 100%)',
                  'box-shadow': '0 4px 14px rgba(206, 33, 0, 0.3)',
                }}
              >
                Download Free
              </a>
              <a
                href="#features"
                class={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  h: '12',
                  px: '8',
                  borderRadius: 'l2',
                  fontWeight: 'semibold',
                  fontSize: 'md',
                  color: 'fg.default',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  border: '1px solid',
                  borderColor: 'gray.a5',
                  transition: 'all 0.2s',
                  _hover: { bg: 'gray.a2', borderColor: 'gray.a6' },
                })}
              >
                Learn More
              </a>
            </Flex>
          </Box>

          {/* App Mockup */}
          <Box class="animate-fade-in-up-delay-3">
            <AppMockup />
          </Box>
        </Grid>
      </Container>
    </Box>
  )
}

/* ================================================================
   App Mockup
   ================================================================ */

function AppMockup() {
  return (
    <Box
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="gray.a4"
      bg="gray.surface.bg"
      maxW={{ base: '100%', lg: '540px' }}
      mx="auto"
      boxShadow="2xl"
    >
      {/* Title bar */}
      <Flex
        alignItems="center"
        gap="2"
        px="4"
        py="3"
        borderBottom="1px solid"
        borderColor="gray.a3"
        bg="gray.a2"
      >
        <Box w="3" h="3" borderRadius="full" style={{ background: '#ff5f57' }} />
        <Box w="3" h="3" borderRadius="full" style={{ background: '#febc2e' }} />
        <Box w="3" h="3" borderRadius="full" style={{ background: '#28c840' }} />
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

      {/* Note Content */}
      <Box p={{ base: '5', md: '6' }}>
        <Box mb="4">
          <Box
            fontSize="xl"
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

        <Box as="ul" pl="5" mb="4">
          <li
            class={css({
              fontSize: 'sm',
              color: 'fg.default',
              mb: '1.5',
              lineHeight: 'relaxed',
            })}
          >
            Prioritize mobile experience
          </li>
          <li
            class={css({
              fontSize: 'sm',
              color: 'fg.default',
              mb: '1.5',
              lineHeight: 'relaxed',
            })}
          >
            Launch sync feature by March
          </li>
          <li
            class={css({
              fontSize: 'sm',
              color: 'fg.default',
              mb: '1.5',
              lineHeight: 'relaxed',
            })}
          >
            Improve search performance
          </li>
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
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      title: 'Rich Text Editor',
      description:
        'Write with powerful formatting. Headings, lists, code blocks, and more — all with a beautiful, distraction-free interface.',
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
      ),
      title: 'Real-time Sync',
      description:
        'Your notes, everywhere. Seamlessly sync across all your devices in real-time. Never lose a thought again.',
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      title: 'Lightning Fast',
      description:
        'Built for speed. Instant startup, real-time search, and buttery-smooth editing even with thousands of notes.',
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
      title: 'Dark & Light Mode',
      description:
        'Easy on the eyes. Beautiful themes that adapt to your preference, day or night.',
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: 'Cross-Platform',
      description:
        'Works where you work. Available on macOS, Windows, and Linux with a native feel on every platform.',
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      title: 'Privacy First',
      description:
        'Your notes are yours. Local-first storage with optional sync means your data stays under your control.',
    },
  ]

  return (
    <Box as="section" id="features" py={{ base: '16', lg: '24' }}>
      <Container maxW="7xl" px={{ base: '4', md: '6' }}>
        <Box textAlign="center" mb={{ base: '12', lg: '16' }}>
          <h2
            class={css({
              fontSize: { base: '3xl', md: '4xl' },
              fontWeight: 'bold',
              color: 'fg.default',
              letterSpacing: '-0.02em',
            })}
          >
            Everything you need
          </h2>
          <p
            class={css({
              fontSize: { base: 'md', lg: 'lg' },
              color: 'fg.muted',
              mt: '4',
              maxW: 'lg',
              mx: 'auto',
            })}
          >
            Powerful features, beautifully simple design.
          </p>
        </Box>

        <Grid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
          {features.map((feature) => (
            <Box
              p="6"
              borderRadius="xl"
              border="1px solid"
              borderColor="gray.a3"
              bg="gray.surface.bg"
              transition="all 0.2s"
              class={css({
                _hover: {
                  borderColor: 'gray.a5',
                  boxShadow: 'md',
                  transform: 'translateY(-2px)',
                },
              })}
            >
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="12"
                h="12"
                borderRadius="l2"
                bg="flame.a3"
                color="flame.11"
                mb="4"
              >
                {feature.icon}
              </Box>
              <h3
                class={css({
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  color: 'fg.default',
                  mb: '2',
                })}
              >
                {feature.title}
              </h3>
              <p
                class={css({
                  fontSize: 'sm',
                  color: 'fg.muted',
                  lineHeight: 'relaxed',
                })}
              >
                {feature.description}
              </p>
            </Box>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

/* ================================================================
   CTA Section
   ================================================================ */

function CallToAction() {
  return (
    <Box
      as="section"
      id="download"
      py={{ base: '16', lg: '24' }}
      position="relative"
      overflow="hidden"
    >
      {/* Subtle gradient background */}
      <div
        class={css({ position: 'absolute', inset: '0', pointerEvents: 'none' })}
        style={{
          background:
            'linear-gradient(135deg, rgba(255,105,10,0.04) 0%, rgba(206,33,0,0.07) 50%, rgba(66,0,4,0.04) 100%)',
        }}
      />

      <Container
        maxW="3xl"
        px={{ base: '4', md: '6' }}
        position="relative"
        textAlign="center"
      >
        <h2
          class={css({
            fontSize: { base: '3xl', md: '4xl', lg: '5xl' },
            fontWeight: 'bold',
            color: 'fg.default',
            letterSpacing: '-0.02em',
          })}
        >
          Ready to start noting?
        </h2>
        <p
          class={css({
            fontSize: { base: 'md', lg: 'lg' },
            color: 'fg.muted',
            mt: '4',
            mb: '8',
            maxW: 'lg',
            mx: 'auto',
            lineHeight: 'relaxed',
          })}
        >
          Join thousands of writers, developers, and thinkers who've made
          noted. their home for ideas.
        </p>
        <a
          href="#"
          class={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            h: '14',
            px: '10',
            borderRadius: 'l2',
            fontWeight: 'semibold',
            fontSize: 'lg',
            color: 'white',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'all 0.2s',
            _hover: {
              opacity: '0.92',
              transform: 'translateY(-1px)',
            },
            _active: { transform: 'translateY(0)' },
          })}
          style={{
            background:
              'linear-gradient(135deg, #ff690a 0%, #ce2100 100%)',
            'box-shadow': '0 4px 20px rgba(206, 33, 0, 0.3)',
          }}
        >
          Download for Free
        </a>
      </Container>
    </Box>
  )
}

/* ================================================================
   Footer
   ================================================================ */

function Footer() {
  return (
    <Box as="footer" borderTop="1px solid" borderColor="gray.a3" py="8">
      <Container maxW="7xl" px={{ base: '4', md: '6' }}>
        <Flex
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap="4"
        >
          <a href="/" class={css({ display: 'flex', alignItems: 'center' })}>
            <img
              src="/noted-logo.svg"
              alt="noted."
              class={css({ h: '5' })}
            />
          </a>
          <Flex alignItems="center" gap="6">
            <a
              href="#features"
              class={css({
                fontSize: 'sm',
                color: 'fg.subtle',
                textDecoration: 'none',
                _hover: { color: 'fg.muted' },
              })}
            >
              Features
            </a>
            <a
              href="#download"
              class={css({
                fontSize: 'sm',
                color: 'fg.subtle',
                textDecoration: 'none',
                _hover: { color: 'fg.muted' },
              })}
            >
              Download
            </a>
          </Flex>
          <p class={css({ fontSize: 'sm', color: 'fg.subtle' })}>
            &copy; 2026 noted. All rights reserved.
          </p>
        </Flex>
      </Container>
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
      <main>
        <Hero />
        <Features />
        <CallToAction />
      </main>
      <Footer />
    </>
  )
}
