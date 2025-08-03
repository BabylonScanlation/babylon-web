// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual que simula los módulos nativos de Node.js
const nodePolyfills = `
  export const fs = {};
  export const path = {};
  export const os = {};
  export const crypto = {};
  export const url = {};
  export const http = {};
  export const https = {};
  export const zlib = {};
  export const util = {};
  export const stream = {};
  export const events = {};
  export const buffer = {};
  export const querystring = {};
  export const child_process = {};
  export const net = {};
  export const tls = {};
  export const assert = {};
  export const http2 = {};
  export const process = { env: {} };
  export default {};
`;

// Lista de todos los módulos de Node.js que necesitamos neutralizar
const nodeBuiltIns = [
  "fs", "path", "os", "crypto", "url", "http", "https", "zlib", "util",
  "stream", "events", "buffer", "querystring", "child_process", "net",
  "tls", "assert", "http2", "process",
  // Incluimos las versiones con el prefijo "node:"
  "node:fs", "node:path", "node:os", "node:crypto", "node:url",
  "node:http", "node:https", "node:zlib", "node:util", "node:stream",
  "node:events", "node:buffer", "node:querystring", "node:child_process",
  "node:net", "node:tls", "node:assert", "node:http2", "node:process",
  "node:fs/promises"
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
      alias: nodeBuiltIns.map(id => ({
        find: id,
        replacement: 'virtual:node-polyfills'
      })),
    }, // <--- ¡AQUÍ ESTABA EL ERROR! Faltaba esta coma.
    plugins: [
      {
        name: 'vite-plugin-node-polyfills-custom',
        resolveId(id) {
          if (id === 'virtual:node-polyfills') {
            return id;
          }
        },
        load(id) {
          if (id === 'virtual:node-polyfills') {
            return nodePolyfills;
          }
        },
      },
    ],
    ssr: {
      noExternal: ['firebase-admin'],
    },
  },
});