import { css } from 'styled-system/css'
import { Nav } from './shared'
import type { JSX } from 'solid-js'

export function Layout(props: { children: JSX.Element }) {
  return (
    <>
      <Nav />
      <main style={{ 'background-color': 'var(--surface-dim)', 'min-height': '100vh' }}>
        {props.children}
      </main>
    </>
  )
}
