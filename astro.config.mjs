// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Módulo virtual que simula los módulos nativos de Node.js de forma robusta y definitiva
const nodePolyfills = `
  // --- Implementaciones mínimas para Astro ---
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
  export const { pathToFileURL, fileURLToPath } = url;
  export const { basename, dirname, extname } = path;

  // --- Polyfill robusto de process ---
  const process = {
    env: { FORCE_COLOR: '0', NO_COLOR: '1' }, // Desactiva colores proactivamente
    version: 'v18.0.0',
    versions: { node: '18.0.0' },
    on: () => {},
    addListener: () => {},
    once: () => {},
    off: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    emit: () => {},
    prependListener: () => {},
    prependOnceListener: () => {},
    listeners: () => [],
    binding: () => ({}),
    cwd: () => '/',
    chdir: () => {},
    umask: () => 0,
    nextTick: (cb, ...args) => Promise.resolve().then(() => cb(...args)),
    platform: 'linux',
    stdout: {
      isTTY: false,
      write: () => true,
      columns: 80,
      rows: 24,
      on: ()=>{},
      // ¡Crucial! Métodos de conversión a primitivos
      [Symbol.toPrimitive]: () => '[object process.stdout]',
      toString: () => '[object process.stdout]',
      valueOf: () => null
    },
    stderr: {
      isTTY: false,
      write: () => true,
      columns: 80,
      rows: 24,
      on: ()=>{},
      // ¡Crucial! Métodos de conversión a primitivos
      [Symbol.toPrimitive]: () => '[object process.stderr]',
      toString: () => '[object process.stderr]',
      valueOf: () => null
    },
    argv: ['/usr/bin/node'],
  };

  // Asignar a global para compatibilidad con librerías de Node.js
  if (typeof globalThis.process === 'undefined') {
    globalThis.process = process;
  }
  if (typeof global === 'undefined') {
    globalThis.global = globalThis;
  }
  
  export { process };

  // --- Stubs vacíos para el resto ---
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
  
  export default { fs, path, os, crypto, url, process };
`;

const nodeBuiltIns = [
  "fs", "path", "os", "crypto", "url", "http", "https", "zlib", "util",
  "stream", "events", "buffer", "querystring", "child_process", "net",
  "tls", "assert", "http2", "process"
];

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: "cloudflare",
  }),
  vite: {
    resolve: {
      alias: [
        ...nodeBuiltIns.map(id => ({ find: new RegExp(`^${id}$`), replacement: 'virtual:node-polyfills' })),
        ...nodeBuiltIns.map(id => ({ find: new RegExp(`^node:${id}$`), replacement: 'virtual:node-polyfills' })),
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