import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { key } = params;
  const { env } = locals.runtime;

  // Debug incoming request - RESTORED FOR DEBUGGING
  console.log(`[Proxy] Request Key: "${key}"`);

  // Si la clave es explícitamente "undefined" o "null" (string), o vacía, es un 404 claro.
  if (!key || key === 'undefined' || key === 'null') {
    return new Response('Asset not found', { status: 404 });
  }

  // --- CORS PREFLIGHT SUPPORT ---
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (!env.R2_ASSETS) {
    console.error('[Proxy] R2_ASSETS binding missing');
    return new Response('Storage configuration missing', { status: 500 });
  }

  try {
    // Decode URI component just in case
    const objectKey = decodeURIComponent(key);

    // Support conditional requests
    const etag = request.headers.get('If-None-Match');
    const object = await env.R2_ASSETS.get(objectKey, {
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });

    if (!object) {
      console.warn(`[Proxy] 404 Not Found in Local R2: ${objectKey}`);

      // Orion: Fallback to Public URL in DEV if not found locally
      const publicBase = env.R2_PUBLIC_URL_ASSETS;
      if (publicBase && (import.meta.env.DEV || request.url.includes('localhost'))) {
        console.log(`[Proxy] Attempting fallback to public URL: ${publicBase}/${objectKey}`);
        try {
          const response = await fetch(`${publicBase}/${objectKey}`);
          if (response.ok) {
            console.log(`[Proxy] Fallback Success: ${objectKey}`);
            
            // Orion: Clonar el cuerpo para guardarlo en local sin bloquear la respuesta al usuario
            const blob = await response.blob();
            
            // Guardar en R2 local en segundo plano si estamos en un contexto de Worker
            if (locals.runtime.ctx?.waitUntil) {
              locals.runtime.ctx.waitUntil(
                env.R2_ASSETS.put(objectKey, blob, {
                  httpMetadata: {
                    contentType: response.headers.get('content-type') || 'image/jpeg',
                    cacheControl: 'public, max-age=31536000, immutable'
                  }
                }).then(() => console.log(`[Proxy] Asset seeded locally: ${objectKey}`))
              );
            }

            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
            return new Response(blob, {
              status: 200,
              headers: newHeaders,
            });
          }
        } catch (fetchError) {
          console.error(`[Proxy] Fallback failed for ${objectKey}:`, fetchError);
        }
      }

      return new Response('Not found', { status: 404 });
    }

    // Handle 304 Not Modified
    if ('body' in object && !object.body) {
      return new Response(null, {
        status: 304,
        headers: {
          'Access-Control-Allow-Origin': '*',
          ETag: object.httpEtag,
        },
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

    // 2. Identificadores críticos y tamaño (Esencial para estabilidad del stream)
    headers.set('ETag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Content-Length', object.size.toString());

    // 3. Estrategia de Caché robusta (Inmutable para assets)
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // Retorno de stream directo con longitud correcta para evitar ERR_CONNECTION_CLOSED
    return new Response(object.body, {
      headers,
    });
  } catch (e) {
    console.error(`[Proxy] Error serving asset ${key}:`, e);
    return new Response('Internal Error', { status: 500 });
  }
};
