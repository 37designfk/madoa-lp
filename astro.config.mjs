// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://37designfk.github.io',
  base: '/madoa-lp',
  vite: {
    plugins: [tailwindcss()]
  }
});