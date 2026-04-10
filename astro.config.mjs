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
  security: {
    checkOrigin: true,
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
      include: ['svelte', 'swiper', 'swiper/modules'],
      exclude: ['@cf-wasm/photon'],
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
    build: {
      // Orion: Endurecimiento de Seguridad (Hardening)
      sourcemap: false, // Nunca generar mapas de código en producción
      cssCodeSplit: true,
      rollupOptions: {
        external: ['@cf-wasm/photon'],
        output: {
          // Agrupa todos los chunks de svelte internos en uno solo
          manualChunks(id) {
            if (id.includes('svelte')) return 'svelte-vendor';
            if (id.includes('node_modules')) return 'vendor';
          },
        },
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
