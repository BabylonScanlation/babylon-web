// src/cloudflare.d.ts
declare module 'cloudflare:workers' {
  // biome-ignore lint/suspicious/noExplicitAny: bypass
  export const env: any;
  // biome-ignore lint/suspicious/noExplicitAny: bypass
  export const ctx: any;
  // biome-ignore lint/suspicious/noExplicitAny: bypass
  export const caches: any;
}
