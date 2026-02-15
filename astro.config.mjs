import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://babylon-scanlation.pages.dev',
  output: 'server',

  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: 'cloudflare',
  }),

  vite: {
    // Ya no se necesitan los complejos polyfills ni alias
    ssr: {
      // Solo nos aseguramos de que firebase-admin (si se usa en otro lugar) sea manejado por Vite
      noExternal: ['firebase-admin'],
      external: ['@cloudflare/workers-types'],
    },
    optimizeDeps: {
      exclude: ['swiper', 'swiper/modules', '@cf-wasm/photon'],
    },
    build: {
      rollupOptions: {
        external: ['@cf-wasm/photon']
      }
    }
  },

  integrations: [svelte(), sitemap()],
});