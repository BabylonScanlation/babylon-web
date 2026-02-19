import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';

import { siteConfig } from './src/site.config';

export default defineConfig({
  site: siteConfig.url,
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
        external: ['@cf-wasm/photon'],
      },
    },
  },

  integrations: [
    svelte(),
    sitemap({
      customPages: [`${siteConfig.url}/sitemap-dynamic.xml`],
    }),
  ],
});
