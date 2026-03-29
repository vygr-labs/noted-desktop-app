import { Title } from '@solidjs/meta'
import { HttpStatusCode } from '@solidjs/start'
import { css } from 'styled-system/css'
import { Layout } from '~/components/Layout'
import { monoLabelStyle } from '~/components/shared'

export default function NotFound() {
  return (
    <Layout>
      <Title>Page Not Found — noted.</Title>
      <HttpStatusCode code={404} />
      <div
        class={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: '6',
          pt: '32',
          pb: '20',
          minHeight: 'calc(100vh - 64px)',
        })}
      >
        <div
          class={css({
            maxWidth: '440px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fade-in-up 0.7s cubic-bezier(0.23, 1, 0.32, 1) both',
          })}
        >
          {/* Icon */}
          <div
            class={css({
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: '6',
            })}
            style={{
              'background-color': 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style={{ color: 'var(--on-surface-variant)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>

          {/* Label */}
          <span
            class="animate-fade-in-up-delay-1"
            style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)', 'margin-bottom': '12px' }}
          >
            404
          </span>

          {/* Title */}
          <h1
            class={`animate-fade-in-up-delay-1 ${css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: '800',
              letterSpacing: '-0.03em',
              textAlign: 'center',
              mb: '3',
            })}`}
            style={{ color: 'var(--on-surface)' }}
          >
            Page not found
          </h1>

          {/* Description */}
          <p
            class={`animate-fade-in-up-delay-2 ${css({
              fontSize: '15px',
              lineHeight: '1.6',
              textAlign: 'center',
              mb: '8',
              maxWidth: '360px',
            })}`}
            style={{ color: 'var(--on-surface-variant)' }}
          >
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Actions */}
          <div
            class={`animate-fade-in-up-delay-3 ${css({
              display: 'flex',
              gap: '3',
            })}`}
          >
            <a
              href="/"
              class={`hero-cta-gradient ${css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2',
                px: '6',
                py: '3',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                color: 'white',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                _hover: { opacity: 0.9 },
              })}`}
            >
              Go home
            </a>
            <a
              href="/download"
              class={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2',
                px: '6',
                py: '3',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                _hover: { opacity: 0.8 },
              })}
              style={{
                'background-color': 'var(--surface-low)',
                color: 'var(--on-surface)',
                border: '1px solid var(--surface-border)',
              }}
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
