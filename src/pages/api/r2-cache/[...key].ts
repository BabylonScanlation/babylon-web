// src/pages/api/r2-cache/[...key].ts
import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { verifySignature } from '../../../lib/crypto';
import { getDB } from '../../../lib/db-client';
import { series, chapters } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { ZipReader, HttpReader, Uint8ArrayWriter } from '@zip.js/zip.js';

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { key } = params;
  const runtime = locals.runtime;
  const env = runtime?.env || (process.env as any);
  const R2_CACHE = env.R2_CACHE;
  const AUTH_SECRET = env.AUTH_SECRET;
  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  
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
    return new Response('Invalid or expired security token (HMAC mismatch)', { status: 403 });
  }

  try {
    // 1. INTENTO DESDE R2 (Cache Hit)
    const etag = request.headers.get('If-None-Match');
    let object = await R2_CACHE.get(key, {
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });

    // 2. LÓGICA DE RECUPERACIÓN (Cache Miss -> Fetch from Telegram)
    if (object === null) {
      console.log(`[R2_PROXY] Cache MISS para: ${key}. Intentando recuperación desde Telegram...`);
      
      // Parsear la key: serie/capitulo/hash/nombre_archivo
      const parts = key.split('/');
      if (parts.length < 4) {
        return new Response('Invalid file key structure for recovery', { status: 404 });
      }

      const seriesSlug = parts[0];
      const chapterNumStr = parts[1];
      const filename = parts.slice(3).join('/'); // El nombre del archivo puede tener subcarpetas

      const db = getDB(env);
      if (!db) throw new Error('DB connection failed during recovery');

      // Buscar el telegram_file_id del capítulo
      const chapterData = await db
        .select({ fileId: chapters.telegramFileId })
        .from(chapters)
        .innerJoin(series, eq(chapters.seriesId, series.id))
        .where(
          and(
            eq(series.slug, seriesSlug),
            eq(chapters.chapterNumber, parseFloat(chapterNumStr))
          )
        )
        .get();

      if (!chapterData?.fileId || !TELEGRAM_BOT_TOKEN) {
        return new Response('File not found in R2 and no recovery source available', { status: 404 });
      }

      // --- RECUPERACIÓN DESDE TELEGRAM ---
      const fileInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${chapterData.fileId}`;
      const fileInfoResp = await fetch(fileInfoUrl);
      const fileInfo = await fileInfoResp.json() as any;

      if (!fileInfo?.ok || !fileInfo?.result?.file_path) {
        return new Response('Recovery failed: Telegram file path not found', { status: 502 });
      }

      const telegramUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
      const zipReader = new ZipReader(new HttpReader(telegramUrl));
      const entries = await zipReader.getEntries();
      
      // Buscar la entrada exacta (o una aproximación si el nombre cambió)
      const entry = entries.find(e => e.filename.includes(filename) || filename.includes(e.filename));
      
      if (!entry || !entry.getData) {
        await zipReader.close();
        return new Response(`Recovery failed: File ${filename} not found in Telegram ZIP`, { status: 404 });
      }

      const imageBuffer = await entry.getData(new Uint8ArrayWriter());
      await zipReader.close();

      const contentType = filename.endsWith('.webp') ? 'image/webp' : 
                          filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Guardar en R2 en segundo plano (Background caching)
      if (runtime?.ctx?.waitUntil) {
        runtime.ctx.waitUntil(
          R2_CACHE.put(key, imageBuffer, {
            httpMetadata: { 
              contentType,
              cacheControl: 'public, max-age=31536000, s-maxage=2592000, immutable'
            }
          }).catch(e => console.error(`[R2_PROXY] Falló guardado en caché: ${key}`, e))
        );
      } else {
        // Fallback para entornos que no soportan waitUntil (como local sin proxy)
        await R2_CACHE.put(key, imageBuffer, {
          httpMetadata: { contentType }
        });
      }

      // Entregar al usuario inmediatamente
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, s-maxage=2592000, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Status': 'RECOVERED_FROM_TELEGRAM',
          'Content-Length': imageBuffer.length.toString()
        }
      });
    }

    // 3. RESPUESTA NORMAL DESDE R2 (Cache Hit o 304)
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
    const meta = object.httpMetadata;
    if (meta?.contentType) headers.set('Content-Type', meta.contentType);
    if (meta?.cacheControl) headers.set('Cache-Control', meta.cacheControl);
    
    if (!headers.has('Content-Type')) {
      const contentType = key.endsWith('.webp') ? 'image/webp' : 
                          key.endsWith('.png') ? 'image/png' : 'image/jpeg';
      headers.set('Content-Type', contentType);
    }

    headers.set('ETag', object.httpEtag);
    headers.set('Content-Length', object.size.toString());
    
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=2592000, immutable');
    }
    
    headers.set('Access-Control-Allow-Origin', '*'); 
    headers.set('X-Cache-Status': 'HIT_R2');

    return new Response(object.body, {
      headers,
    });

  } catch (error) {
    logError(error, 'Error al obtener objeto de R2 Cache', { key });
    return new Response('Internal Server Error', { status: 500 });
  }
};