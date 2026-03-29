import { css } from 'styled-system/css'
import { useParams } from '@solidjs/router'
import { createSignal, onMount } from 'solid-js'
import { Layout } from '~/components/Layout'
import { monoLabelStyle } from '~/components/shared'

export default function JoinPage() {
  const params = useParams<{ code: string }>()
  const shareCode = () => decodeURIComponent(params.code || '')
  const deepLink = () => `noted://share/${shareCode()}`
  const [copied, setCopied] = createSignal(false)
  const [attempted, setAttempted] = createSignal(false)

  onMount(() => {
    if (shareCode()) {
      setTimeout(() => {
        window.location.href = deepLink()
        setAttempted(true)
      }, 800)
    }
  })

  function copyCode() {
    navigator.clipboard.writeText(shareCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Layout>
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
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </div>

          {/* Label */}
          <span
            class="animate-fade-in-up-delay-1"
            style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)', 'margin-bottom': '12px' }}
          >
            Shared Note
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
            Someone shared a note with you
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
            Open it in the noted. app to view and collaborate in real-time.
          </p>

          {/* Action card */}
          <div
            class={`animate-fade-in-up-delay-3 ${css({
              width: '100%',
              borderRadius: '16px',
              p: '6',
              display: 'flex',
              flexDirection: 'column',
              gap: '3',
            })}`}
            style={{
              'background-color': 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
            }}
          >
            {/* Open button */}
            <a
              href={deepLink()}
              class={`hero-cta-gradient ${css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2',
                width: '100%',
                py: '3',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                color: 'white',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                _hover: { opacity: 0.9 },
              })}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open in noted.
            </a>

            {/* Download button */}
            <a
              href="/download?auto"
              class={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2',
                width: '100%',
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
                'background-color': 'var(--surface-container)',
                color: 'var(--on-surface)',
                border: '1px solid var(--surface-border)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Don't have noted.? Download it
            </a>
          </div>

          {/* Share code fallback */}
          <div
            class={`animate-fade-in-up-delay-3 ${css({
              width: '100%',
              mt: '4',
              borderRadius: '12px',
              p: '5',
            })}`}
            style={{
              'background-color': 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
            }}
          >
            <span style={{ ...monoLabelStyle, color: 'var(--on-surface-variant)' }}>
              Or paste this code in the app
            </span>
            <div
              class={css({
                mt: '3',
                display: 'flex',
                gap: '2',
                alignItems: 'center',
              })}
            >
              <div
                class={css({
                  flex: 1,
                  px: '3',
                  py: '2.5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  wordBreak: 'break-all',
                  lineHeight: '1.5',
                  userSelect: 'all',
                })}
                style={{
                  'background-color': 'var(--surface-container)',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--surface-border)',
                }}
              >
                {shareCode()}
              </div>
              <button
                class={css({
                  px: '3',
                  py: '2.5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  _hover: { opacity: 0.8 },
                })}
                style={{
                  'background-color': 'var(--surface-container)',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--surface-border)',
                }}
                onClick={copyCode}
              >
                {copied() ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Security hint */}
          <p
            class={css({
              mt: '6',
              fontSize: '12px',
              textAlign: 'center',
              lineHeight: '1.5',
            })}
            style={{ color: 'var(--on-surface-variant)' }}
          >
            Your note is synced securely. Only people with this link can access it.
          </p>
        </div>
      </div>
    </Layout>
  )
}
