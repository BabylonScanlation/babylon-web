// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
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
    },
  },
});
