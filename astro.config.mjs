// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual que simula los módulos nativos de Node.js de forma más robusta
const nodePolyfills = `
  // --- Implementaciones mínimas para Astro y sus dependencias ---
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
  
  // Exportaciones nombradas directas que el build de Astro busca
  export const { pathToFileURL, fileURLToPath } = url;
  export const { basename, dirname, extname } = path;

  // --- Stubs y Polyfills para el resto de dependencias ---
  export const fs = { promises: {} };
  export const os = { homedir: () => '/' };
  export const crypto = {};
  export const child_process = {};
  export const net = {};
  export const tls = {};
  export const http2 = {};
  export const events = {};
  export const zlib = {};
  export const stream = {};
  export const assert = {};
  export const buffer = { Buffer: {} };
  export const querystring = {};
  export const util = { inspect: () => '' };
  export const http = {};
  export const https = {};
  
  // --- CORRECCIÓN CLAVE PARA EL ERROR 500 DE EJECUCIÓN ---
  // Una simulación más completa del objeto 'process'
  export const process = {
    env: {},
    stdout: { isTTY: false, write: () => {} },
    stderr: { isTTY: false, write: () => {} },
    cwd: () => '/',
    nextTick: (cb) => Promise.resolve().then(cb),
    on: () => {},
    platform: 'linux'
  };

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
        ...nodeBuiltIns.map(id => ({
          find: new RegExp(`^${id}$`),
          replacement: 'virtual:node-polyfills'
        })),
        ...nodeBuiltIns.map(id => ({
          find: new RegExp(`^node:${id}$`),
          replacement: 'virtual:node-polyfills'
        })),
        { find: 'node:fs/promises', replacement: 'virtual:node-polyfills' }
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