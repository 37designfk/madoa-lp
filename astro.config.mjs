// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
const isProduction = process.env.DEPLOY_TARGET === 'production';

export default defineConfig({
  site: isProduction ? 'https://lp.madoa.co.jp' : 'https://37designfk.github.io',
  base: isProduction ? '/' : '/madoa-lp/',
  vite: {
    plugins: [tailwindcss()]
  }
});