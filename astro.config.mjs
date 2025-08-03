// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual para reemplazar las dependencias de Node.js no compatibles
const virtualNodeJsModules = `
  export const fs = {};
  export const path = {};
  export const crypto = {};
  export const os = {};
  export default {};
`;

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "cloudflare",
  }),
  vite: {
    plugins: [
      {
        name: 'vite-plugin-node-polyfills',
        resolveId(id) {
          if (id.startsWith('node:')) {
            // Redirige importaciones como 'node:fs' al módulo virtual
            return 'virtual:node-polyfills';
          }
        },
        load(id) {
          if (id === 'virtual:node-polyfills') {
            return virtualNodeJsModules;
          }
        },
      },
    ],
    ssr: {
      // Nos aseguramos de que firebase-admin sea procesado por Vite
      noExternal: ['firebase-admin'],
    },
  },
});