// src/pages/api/r2-cache/[...key].ts
import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { verifySignature } from '../../../lib/crypto';

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { key } = params;
  const env = locals.runtime?.env || (process.env as any);
  const R2_CACHE = env.R2_CACHE;
  const AUTH_SECRET = env.AUTH_SECRET;
  
  const url = new URL(request.url);
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('signature');

  if (!key) {
    return new Response('File key is required', { status: 400 });
  }

  // --- CORS PREFLIGHT SUPPORT ---
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Búsqueda estricta del secreto y saneamiento agresivo
  let secret = AUTH_SECRET || import.meta.env.AUTH_SECRET || (process.env as any).AUTH_SECRET;
  if (typeof secret === 'string') {
    // Saneamiento mejorado: elimina comillas (simples, dobles, curvas), saltos de línea y espacios
    secret = secret.replace(/['"“”]/g, '').replace(/\\n/g, '').trim();
  }

  if (!secret) {
    return new Response('Security configuration missing', { status: 500 });
  }

  // Verify signature strictly
  if (!expires || !signature) {
    return new Response('Security parameters missing (expires/signature)', { status: 403 });
  }

  const isValid = await verifySignature(
    `/api/r2-cache/${key}`,
    expires,
    signature,
    secret
  );

  if (!isValid) {
    // Audit log for security failures in development
    console.warn(`[SEC_R2] Invalid HMAC for: ${key}`);
    console.warn(`[SEC_R2] Expected Path: /api/r2-cache/${key}`);
    console.warn(`[SEC_R2] Expires: ${expires}`);
    console.warn(`[SEC_R2] Signature: ${signature}`);
    return new Response('Invalid or expired security token (HMAC mismatch)', { status: 403 });
  }

  try {
    console.log(`[R2_PROXY] Signature OK. Fetching from R2: ${key}`);
    // Support conditional requests
    const etag = request.headers.get('If-None-Match');
    const object = await R2_CACHE.get(key, {
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });

    if (object === null) {
      return new Response(`File not found: ${key}`, { status: 404 });
    }

    // Handle 304 Not Modified
    if ('body' in object && !object.body) {
      return new Response(null, {
        status: 304,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'ETag': object.httpEtag,
        }
      });
    }

    const headers = new Headers();

    // 1. Asignación manual de metadatos para evitar errores de serialización en local
    const meta = object.httpMetadata;
    if (meta?.contentType) headers.set('Content-Type', meta.contentType);
    if (meta?.cacheControl) headers.set('Cache-Control', meta.cacheControl);
    if (meta?.contentEncoding) headers.set('Content-Encoding', meta.contentEncoding);
    if (meta?.contentLanguage) headers.set('Content-Language', meta.contentLanguage);
    if (meta?.contentDisposition) headers.set('Content-Disposition', meta.contentDisposition);
    
    // Fallback de Content-Type basado en extensión si no existe en metadatos
    if (!headers.has('Content-Type')) {
      const contentType = key.endsWith('.webp') ? 'image/webp' : 
                          key.endsWith('.png') ? 'image/png' : 'image/jpeg';
      headers.set('Content-Type', contentType);
    }

    // 2. Identificadores críticos y tamaño (Esencial para estabilidad del stream)
    headers.set('ETag', object.httpEtag);
    headers.set('Content-Length', object.size.toString());
    
    // 3. Estrategia de Caché por defecto si R2 no tiene una definida
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=2592000, immutable');
    }
    
    // 4. CORS y Cloudflare Optimization
    headers.set('Access-Control-Allow-Origin', '*'); 
    headers.set('Cloudflare-CDN-Cache-Control', 'max-age=2592000');

    // Retorno de stream directo (Zero-copy)
    return new Response(object.body, {
      headers,
    });

  } catch (error) {
    logError(error, 'Error al obtener objeto de R2 Cache', { key });
    return new Response('Internal Server Error', { status: 500 });
  }
};