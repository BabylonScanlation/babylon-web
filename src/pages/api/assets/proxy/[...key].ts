import type { APIRoute } from 'astro';
import { deobfuscate } from '../../../../lib/obfuscator';

export const GET: APIRoute = async ({ params, locals, request }) => {
  let { key } = params;
  const { env } = locals.runtime;
  const isDev = import.meta.env.DEV || request.url.includes('localhost');

  // Si la clave es explícitamente "undefined" o "null" (string), o vacía, es un 404 claro.
  if (!key || key === 'undefined' || key === 'null') {
    return new Response('Asset not found', { status: 404 });
  }

  // Orion: Seguridad - Bloqueo Nuclear (Solo peticiones autorizadas por nuestro JS o Referer propio)
  const shieldToken = request.headers.get('X-Shield-Token');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host') || '';

  const configuredShieldToken = env.SHIELD_TOKEN;
  
  if (!configuredShieldToken) {
    console.error('[SECURITY] SHIELD_TOKEN is not configured in production');
    return new Response('Security Configuration Error', { status: 500 });
  }

  // Bloqueo: Si no hay token de escudo Y el referer es inválido o falta, denegamos.
  const isAuthorized = (shieldToken === configuredShieldToken) || (referer && referer.includes(host));

  if (!isAuthorized) {
    return new Response('Unauthorized Access', { status: 403 });
  }

  // Orion: 1. Cache API (Capa 0)
  const decryptedKey = deobfuscate(key);
  const objectKey = decryptedKey && typeof decryptedKey === 'string' ? decryptedKey : decodeURIComponent(key);

  // Orion: SSRF Protection - Bloquear esquemas no-https y validar hosts externos
  if (objectKey.startsWith('http')) {
    if (!objectKey.startsWith('https://')) {
      return new Response('Invalid scheme. Only HTTPS is allowed.', { status: 400 });
    }

    try {
      const url = new URL(objectKey);
      const allowedHosts = [
        'api.telegram.org',
        'telegra.ph',
        'i.imgur.com',
        'images.mangadex.org',
        'mangadex.org'
      ];
      
      // Bloquear IPs locales/privadas
      if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(url.hostname) || url.hostname === 'localhost') {
        return new Response('Forbidden Host', { status: 403 });
      }

      if (!allowedHosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
        if (isDev) console.warn(`[Proxy] Blocked external fetch to unauthorized host: ${url.hostname}`);
        return new Response('Forbidden External Host', { status: 403 });
      }
    } catch (e) {
      return new Response('Invalid URL', { status: 400 });
    }
  }

  // Orion: Implementación de Cache API (Reducción drástica de costos)
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
  const cacheKey = new Request(request.url, request);
  
  // Intentar recuperar del caché de Cloudflare primero
  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      if (isDev) console.log(`[Proxy] Cache HIT: ${objectKey}`);
      return cachedResponse;
    }
  }

  if (isDev) console.log(`[Proxy] Cache MISS: ${objectKey}`);

  // Función auxiliar para servir y cachear en el CDN global
  const serveAndCache = async (body: any, contentType?: string, etag?: string) => {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (contentType) headers.set('Content-Type', contentType);
    if (etag) headers.set('ETag', etag);
    
    const res = new Response(body, { status: 200, headers });
    if (cache && locals.runtime.ctx?.waitUntil) {
      locals.runtime.ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    return res;
  };

  try {
    // Orion: 2. Intentar buscar en R2_CACHE (Capa 1 - Capítulos/Hot assets)
    if (env.R2_CACHE) {
      const cacheObj = await env.R2_CACHE.get(objectKey);
      if (cacheObj) {
        if (isDev) console.log(`[Proxy] R2_CACHE HIT: ${objectKey}`);
        return serveAndCache(cacheObj.body, cacheObj.httpMetadata?.contentType, cacheObj.httpEtag);
      }
    }

    // Orion: 3. Intentar buscar en R2_ASSETS (Capa 2 - Portadas/Permanentes)
    if (env.R2_ASSETS) {
      const assetObj = await env.R2_ASSETS.get(objectKey);
      if (assetObj) {
        if (isDev) console.log(`[Proxy] R2_ASSETS HIT: ${objectKey}`);
        return serveAndCache(assetObj.body, assetObj.httpMetadata?.contentType, assetObj.httpEtag);
      }
    }

    // Orion: 4. Si es una URL completa, hacemos fetch externo (Capa 3) y sembramos R2_CACHE
    if (objectKey.startsWith('http')) {
      if (isDev) console.log(`[Proxy] FETCHING EXTERNAL: ${objectKey}`);
      const externalRes = await fetch(objectKey);
      if (!externalRes.ok) return new Response('External asset not found', { status: 404 });
      
      const contentType = externalRes.headers.get('content-type') || 'image/webp';
      const blob = await externalRes.blob();

      // Sembrar el R2_CACHE para futuras peticiones (Protege Telegram)
      if (env.R2_CACHE && locals.runtime.ctx?.waitUntil) {
        locals.runtime.ctx.waitUntil(
          env.R2_CACHE.put(objectKey, blob, {
            httpMetadata: { contentType, cacheControl: 'public, max-age=86400' }
          }).then(() => isDev && console.log(`[Proxy] Seeded R2_CACHE: ${objectKey}`))
        );
      }

      return serveAndCache(blob, contentType);
    }

    return new Response('Not found', { status: 404 });

  } catch (e) {
    console.error(`[Proxy] Global Error serving asset ${key}:`, e);
    return new Response('Internal Error', { status: 500 });
  }
};
