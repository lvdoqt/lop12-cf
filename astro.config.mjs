import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://lop12.com',
  base: '/lms',
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    devToolbar: { enabled: false },
  },
});