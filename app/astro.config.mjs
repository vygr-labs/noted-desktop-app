// @ts-check
import { defineConfig } from 'astro/config';

import solidJs from '@astrojs/solid-js';
import relativeLinks from 'astro-relative-links';

// https://astro.build/config
export default defineConfig({
  integrations: [relativeLinks(), solidJs()],
  build: {
    format: 'file',
  },
  server: {
    port: 7241
  }
});