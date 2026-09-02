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
    // Cloudflare's SSR entrypoint is generated/loaded by the Astro adapter.
    // Pre-bundling it can leave a stale deps_ssr file after config or adapter
    // changes, causing /v-sat (and other first-hit SSR routes) to fail in dev.
    optimizeDeps: {
      exclude: [
        '@astrojs/cloudflare/entrypoints/server',
        '@astrojs/cloudflare/entrypoints/server.js',
      ],
    },
    ssr: {
      optimizeDeps: {
        exclude: [
          '@astrojs/cloudflare/entrypoints/server',
          '@astrojs/cloudflare/entrypoints/server.js',
        ],
      },
    },
  },
});
