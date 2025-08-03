// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual que simula los módulos nativos de Node.js de forma más inteligente
const nodePolyfills = `
  // --- IMPLEMENTACIONES MÍNIMAS PARA ASTRO ---
  // Proporcionamos implementaciones básicas para que el build de Astro no falle.
  export const path = {
    sep: '/',
    join: (...args) => args.filter(Boolean).join('/'),
    // CORRECCIÓN DE SINTAXIS EN LA SIGUIENTE LÍNEA
    resolve: (...args) => ('/' + args.filter(Boolean).join('/')).replace(/\\\\/g, '/'),
    dirname: (p) => p.split('/').slice(0, -1).join('/') || '.',
    basename: (p) => p.split('/').pop() || ''
  };
  export const url = {
    pathToFileURL: (p) => 'file://' + p.replace(/\\\\/g, '/'),
    fileURLToPath: (u) => u.startsWith('file:///') ? u.substring(7) : u
  };
  // Exportaciones nombradas directas que el build de Astro busca
  export const pathToFileURL = url.pathToFileURL;
  export const fileURLToPath = url.fileURLToPath;

  // --- STUBS VACÍOS PARA EL RESTO ---
  // El resto de los módulos que necesita firebase-admin pueden ser objetos vacíos.
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
  export const process = { env: {} };

  // Exportación por defecto para compatibilidad
  export default {
    fs, path, os, crypto, url, process
  };
`;

// Lista de todos los módulos de Node.js que necesitamos neutralizar
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