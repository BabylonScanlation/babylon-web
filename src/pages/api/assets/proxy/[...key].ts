import type { APIRoute } from 'astro';
import { deobfuscate } from '../../../../lib/obfuscator';

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { key } = params;
  const { env } = locals.runtime;
  const isDev = import.meta.env.DEV || request.url.includes('localhost');

  // Si la clave es explícitamente "undefined" o "null" (string), o vacía, es un 404 claro.
  if (!key || key === 'undefined' || key === 'null') {
    return new Response('Asset not found', { status: 404 });
  }

  // ASTRA: Bloqueo de Navegación Directa (Anti-New Tab / Anti-Download)
  // Rechazamos peticiones que el navegador identifica como navegación de usuario.
  const secDest = request.headers.get('Sec-Fetch-Dest');
  const secMode = request.headers.get('Sec-Fetch-Mode');
  const secSite = request.headers.get('Sec-Fetch-Site');
  const babylonService = request.headers.get('X-Babylon-Service');

  // EL MURO DEFINITIVO: Solo permitimos peticiones que traigan nuestro encabezado secreto.
  // Un usuario abriendo una pestaña nueva NUNCA podrá enviar este encabezado.
  if (babylonService !== 'nuclear-loader') {
    // Astra: Bloqueo radical. Sin el header no hay imagen, punto.
    return new Response('Forbidden: Internal Service Only', {
      status: 403,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
    });
  }

  // Si el destino es 'document' o el modo es 'navigate', es un "Abrir en nueva pestaña".
  if (secDest === 'document' || secMode === 'navigate' || (secSite && secSite !== 'same-origin')) {
    if (isDev) console.warn(`[Proxy] Blocked unauthorized direct navigation for: ${key}`);
    return new Response('Direct access forbidden.', { status: 403 });
  }

  // Orion: Seguridad - Bloqueo Nuclear
  const shieldToken = request.headers.get('X-Shield-Token');

  const configuredShieldToken = env.SHIELD_TOKEN;

  // Bloqueo: Autorizamos si viene el token correcto.
  // YA NO HAY BYPASS PARA LOCALHOST (Seguridad Real en Pruebas)
  const isAuthorized =
    shieldToken && configuredShieldToken && shieldToken === configuredShieldToken;

  if (!isAuthorized && !isDev) {
    return new Response('Unauthorized Access', { status: 403 });
  }

  // Orion: 1. Desofuscación Inteligente
  const salt = env.INTERNAL_CRYPTO_SALT;
  const decodedKey = decodeURIComponent(key);
  let objectKey = decodedKey;

  // Astra Orion: Solo intentamos desofuscar si la clave NO parece una ruta clara.
  if (!decodedKey.includes('/') || decodedKey.startsWith('http')) {
    try {
      // Si hay salt, intentamos desofuscar. Si no hay salt, usamos la key tal cual.
      const decrypted = salt ? deobfuscate(key, salt) : null;
      if (decrypted && typeof decrypted === 'string') {
        objectKey = decrypted;
        if (isDev) console.log(`[Proxy] De-obfuscated: ${key} -> ${objectKey}`);
      }
    } catch (e) {
      // Ignoramos fallos de desofuscación
    }
  } else {
    if (isDev) console.log(`[Proxy] Clear Path Detected: ${objectKey}`);
  }

  // Orion: SSRF Protection - Bloquear esquemas no-https y validar hosts externos
  if (objectKey.startsWith('http')) {
    if (!objectKey.startsWith('https://')) {
      return new Response('Invalid scheme. Only HTTPS is allowed.', {
        status: 400,
      });
    }

    try {
      const url = new URL(objectKey);
      const allowedHosts = [
        'api.telegram.org',
        'pub-2e7d3fdb6a36489c808eaae6d2263bc7.r2.dev', // Babylon Production R2
      ];

      // Bloquear IPs locales/privadas
      if (
        /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(url.hostname) ||
        url.hostname === 'localhost'
      ) {
        return new Response('Forbidden Host', { status: 403 });
      }

      if (!allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
        if (isDev)
          console.warn(`[Proxy] Blocked external fetch to unauthorized host: ${url.hostname}`);
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
    headers.set('Vary', 'X-Babylon-Service'); // Astra: Clave para particionar el caché del navegador
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
      } else if (isDev) {
        console.log(`[Proxy] R2_CACHE MISS for key: ${objectKey}`);
      }
    } else if (isDev) {
      console.warn('[Proxy] R2_CACHE binding is missing');
    }

    // Orion: 3. Intentar buscar en R2_ASSETS (Capa 2 - Portadas/Permanentes)
    if (env.R2_ASSETS) {
      const assetObj = await env.R2_ASSETS.get(objectKey);
      if (assetObj) {
        if (isDev) console.log(`[Proxy] R2_ASSETS HIT: ${objectKey}`);
        return serveAndCache(assetObj.body, assetObj.httpMetadata?.contentType, assetObj.httpEtag);
      } else if (isDev) {
        console.log(`[Proxy] R2_ASSETS MISS for key: ${objectKey}`);
      }
    } else if (isDev) {
      console.warn('[Proxy] R2_ASSETS binding is missing');
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
            httpMetadata: {
              contentType,
              cacheControl: 'public, max-age=86400',
            },
          }).then(() => isDev && console.log(`[Proxy] Seeded R2_CACHE: ${objectKey}`))
        );
      }

      return serveAndCache(blob, contentType);
    }

    // Orion: 5. Fallback para assets no encontrados localmente (Útil en Desarrollo)
    // Si no se encuentra en R2 local, intentamos buscarlo en la URL pública de producción
    const publicR2 = env.R2_PUBLIC_URL_ASSETS;
    if (publicR2 && !objectKey.startsWith('http')) {
      const fallbackUrl = `${publicR2}/${objectKey}`.replace(/([^:]\/)\/+/g, '$1');
      if (isDev) console.log(`[Proxy] R2 MISS, trying production fallback: ${fallbackUrl}`);

      const externalRes = await fetch(fallbackUrl);
      if (externalRes.ok) {
        const contentType = externalRes.headers.get('content-type') || 'image/webp';
        const blob = await externalRes.blob();
        return serveAndCache(blob, contentType);
      }
    }

    return new Response('Not found', { status: 404 });
  } catch (e) {
    console.error(`[Proxy] Global Error serving asset ${key}:`, e);
    return new Response('Internal Error', { status: 500 });
  }
};
