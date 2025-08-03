// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual que simula los módulos nativos de Node.js de forma más inteligente
const nodePolyfills = `
  // --- IMPLEMENTACIONES MÍNIMAS PARA ASTRO Y LIBS ---
  export const path = {
    sep: '/',
    join: (...args) => args.filter(Boolean).join('/'),
    resolve: (...args) => ('/' + args.filter(Boolean).join('/')).replace(/\\\\/g, '/'),
    dirname: (p) => p.split('/').slice(0, -1).join('/') || '.',
    basename: (p) => p.split('/').pop() || '',
    extname: (p) => {
        const base = p.split('/').pop() || '';
        const parts = base.split('.');
        return parts.length > 1 ? '.' + parts.pop() : '';
    }
  };
  export const url = {
    pathToFileURL: (p) => 'file://' + p.replace(/\\\\/g, '/'),
    fileURLToPath: (u) => u.startsWith('file:///') ? u.substring(7) : u
  };

  export const pathToFileURL = url.pathToFileURL;
  export const fileURLToPath = url.fileURLToPath;
  export const basename = path.basename;
  export const dirname = path.dirname;
  export const extname = path.extname;

  // --- STUBS VACÍOS Y CORRECCIÓN PARA EL ERROR 500 ---
  export const fs = { promises: {} };
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

  // ¡ESTA ES LA CORRECCIÓN CLAVE PARA EL ERROR 500!
  export const process = { env: {}, stdout: null };

  // Exportación por defecto para compatibilidad
  export default {
    fs, path, os, crypto, url, process
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
        ...nodeBuiltIns.map(id => ({
          find: new RegExp(`^${id}$`),
          replacement: 'virtual:node-polyfills'
        })),
        ...nodeBuiltIns.map(id => ({
          find: new RegExp(`^node:${id}$`),
          replacement: 'virtual:node-polyfills'
        })),
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