import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';

import { siteConfig } from './src/site.config';

export default defineConfig({
  site: siteConfig.url,
  output: 'server',
  prefetch: false,
  devToolbar: {
    enabled: false, // Astra: Apagar la toolbar para limpieza total de recursos
  },
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
      // Orion: Endurecimiento de Seguridad (Hardening)
      sourcemap: false, // Nunca generar mapas de código en producción
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
