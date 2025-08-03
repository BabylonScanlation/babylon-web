// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual que simula los módulos nativos de Node.js de forma más inteligente
const nodePolyfills = `
  // Stubs mínimos para módulos que Astro o sus dependencias podrían necesitar
  export const fs = { promises: {} };
  export const path = {
    sep: '/',
    join: (...args) => args.filter(Boolean).join('/'),
    resolve: (...args) => '/' + args.filter(Boolean).join('/'),
    dirname: (p) => p.split('/').slice(0, -1).join('/') || '.',
    basename: (p) => p.split('/').pop() || ''
  };
  export const os = {};
  export const crypto = {};
  export const child_process = {};
  export const net = {};
  export const tls = {};
  export const http2 = {};
  export const events = {};
  export const zlib = {};
  export const stream = {};
  export const assert = {};
  export const buffer = {};
  export const querystring = {};
  export const util = {};
  export const http = {};
  export const https = {};
  
  // --- CORRECCIÓN CRUCIAL PARA EL ERROR DE BUILD ---
  // Implementación mínima compatible para el módulo 'url'
  export const url = {
    pathToFileURL: (p) => new URL(p, 'file:///').href,
    fileURLToPath: (u) => u.startsWith('file:///') ? u.substring(7) : u
  };

  // Exportaciones por defecto
  export default {
    fs,
    path,
    os,
    crypto,
    url,
    process: { env: {} }
  };
`;

const nodeBuiltIns = [
  "fs", "path", "os", "crypto", "url", "http", "https", "zlib", "util",
  "stream", "events", "buffer", "querystring", "child_process", "net",
  "tls", "assert", "http2", "process"
];

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: "cloudflare",
  }),
  vite: {
    resolve: {
      alias: [
        // Alias con expresiones regulares para una coincidencia exacta
        ...nodeBuiltIns.map(id => ({
          find: new RegExp(`^${id}$`),
          replacement: 'virtual:node-polyfills'
        })),
        ...nodeBuiltIns.map(id => ({
          find: new RegExp(`^node:${id}$`),
          replacement: 'virtual:node-polyfills'
        })),
        // Manejo específico para 'fs/promises'
        {
          find: 'node:fs/promises',
          replacement: 'virtual:node-polyfills'
        }
      ]
    },
    plugins: [
      {
        name: 'vite-plugin-node-polyfills-custom',
        resolveId: (id) => id === 'virtual:node-polyfills' ? id : null,
        load: (id) => id === 'virtual:node-polyfills' ? nodePolyfills : null,
      },
    ],
    ssr: {
      noExternal: ['firebase-admin'],
    },
  },
});