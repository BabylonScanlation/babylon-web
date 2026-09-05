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
  server: {
    port: 8789,
  },
  security: {
    checkOrigin: true,
  },
  adapter: cloudflare({
    mode: 'directory',
    platformProxy: {
      enabled: true,
    },
    imageService: 'cloudflare',
    prerenderEnvironment: 'node',
  }),

  vite: {
    // Ya no se necesitan los complejos polyfills ni alias
    ssr: {
      optimizeDeps: {
        noDiscovery: true,
        include: [],
      },
      // Solo nos aseguramos de que firebase-admin (si se usa en otro lugar) sea manejado por Vite
      noExternal: ['firebase-admin'],
      external: ['@cloudflare/workers-types'],
    },
    optimizeDeps: {
      entries: ['src/**/*.{astro,svelte,ts,js}'],
      include: [
        'svelte',
        'svelte/internal/client',
        'svelte/internal/disclose-version',
        'svelte/internal/flags/legacy',
        'svelte/easing',
        'svelte/transition',
        'svelte/animate',
        'swiper',
        'swiper/modules',
        'p-limit',
        'firebase/auth',
        'firebase/app',
        'chart.js',
        '@zip.js/zip.js',
        'astro/actions/runtime/entrypoints/client.js',
        'astro/actions/runtime/entrypoints/server.js',
        'astro/zod',
        '@astrojs/svelte/client.js',
        'astro/virtual-modules/transitions-router.js',
        'astro/virtual-modules/transitions-types.js',
        'astro/virtual-modules/transitions-events.js',
        'astro/virtual-modules/transitions-swap-functions.js',
      ],
      exclude: ['@cf-wasm/photon', 'astro', '@astrojs/svelte', 'lucia', 'cloudflare:workers'],
    },
    server: {
      allowedHosts: true,
      fs: {
        allow: ['..'],
      },
      watch: {
        ignored: ['**/.wrangler/**']
      }
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
