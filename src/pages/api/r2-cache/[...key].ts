import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { verifySignature } from '../../../lib/crypto';
import { getDB } from '../../../lib/db-client';
import { series, chapters } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { ZipReader, HttpReader, Uint8ArrayWriter, type Entry } from '@zip.js/zip.js';

// ORION: Isolate-level cache para evitar re-leer el directorio central de Telegram repetidamente
interface ZipCacheEntry {
  entries: Entry[];
  filePath: string;
  timestamp: number;
}
const ZIP_CACHE = new Map<string, ZipCacheEntry>();
const CACHE_TTL = 1000 * 60 * 10; // 10 minutos de vida para el índice del ZIP

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

  if (!key) return new Response('File key is required', { status: 400 });

  // --- CORS PREFLIGHT ---
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

  // Saneamiento de secreto
  let secret = AUTH_SECRET || import.meta.env.AUTH_SECRET || (process.env as any).AUTH_SECRET;
  if (typeof secret === 'string') secret = secret.replace(/['"“”]/g, '').replace(/\\n/g, '').trim();
  if (!secret) return new Response('Security configuration missing', { status: 500 });

  // Verificación de firma
  if (!expires || !signature) return new Response('Security parameters missing', { status: 403 });
  const isValid = await verifySignature(`/api/r2-cache/${key}`, expires, signature, secret);
  if (!isValid) return new Response('Invalid security token', { status: 403 });

  try {
    // 1. INTENTO DESDE R2 (Cache Hit)
    const etag = request.headers.get('If-None-Match');
    const object = await R2_CACHE.get(key, {
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });

    // 2. LÓGICA DE RECUPERACIÓN (JIT CACHE - LIGHTSPEED)
    if (object === null) {
      const parts = key.split('/');
      if (parts.length < 4) return new Response('Invalid key structure', { status: 404 });

      const seriesSlug = parts[0];
      const chapterNumStr = parts[1];
      const filename = parts.slice(3).join('/'); 
      const zipCacheKey = `${seriesSlug}/${chapterNumStr}`;

      let entries: Entry[], filePath: string;
      const cached = ZIP_CACHE.get(zipCacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        entries = cached.entries;
        filePath = cached.filePath;
      } else {
        const db = getDB(env);
        const chapterData = await db
          .select({ fileId: chapters.telegramFileId })
          .from(chapters)
          .innerJoin(series, eq(chapters.seriesId, series.id))
          .where(and(eq(series.slug, seriesSlug), eq(chapters.chapterNumber, parseFloat(chapterNumStr))))
          .get();

        if (!chapterData?.fileId || !TELEGRAM_BOT_TOKEN) return new Response('Source not available', { status: 404 });

        const fileInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${chapterData.fileId}`;
        const fileInfo = await (await fetch(fileInfoUrl)).json() as any;
        if (!fileInfo?.ok) throw new Error('Telegram file path failed');
        filePath = fileInfo.result.file_path;

        const telegramUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
        const zipReader = new ZipReader(new HttpReader(telegramUrl));
        entries = await zipReader.getEntries();
        ZIP_CACHE.set(zipCacheKey, { entries, filePath, timestamp: Date.now() });
      }
      
      const entry = entries.find(e => e.filename.includes(filename) || filename.includes(e.filename));
      if (!entry) return new Response(`File ${filename} not found in ZIP`, { status: 404 });

      // Extraer datos usando el filePath cacheado
      const telegramUrlForEntry = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
      const tempZipReader = new ZipReader(new HttpReader(telegramUrlForEntry));
      const entryToExtract = (await tempZipReader.getEntries()).find(e => e.filename === entry.filename);
      
      if (!entryToExtract?.getData) {
          await tempZipReader.close();
          return new Response('Extraction failed', { status: 500 });
      }

      const imageBuffer = await entryToExtract.getData(new Uint8ArrayWriter());
      await tempZipReader.close();

      const contentType = filename.toLowerCase().endsWith('.webp') ? 'image/webp' : 
                          filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Background caching
      if (runtime?.ctx?.waitUntil) {
        runtime.ctx.waitUntil(
          R2_CACHE.put(key, imageBuffer, {
            httpMetadata: { 
              contentType,
              cacheControl: 'public, max-age=31536000, s-maxage=2592000, immutable'
            }
          })
        );
      }

      return new Response(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, s-maxage=2592000, immutable',
          'X-Cache-Status': 'JIT_RECOVERED',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 3. RESPUESTA NORMAL (R2 HIT)
    const headers = new Headers();
    if (object.httpMetadata?.contentType) headers.set('Content-Type', object.httpMetadata.contentType);
    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=2592000, immutable');
    headers.set('ETag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*'); 
    headers.set('X-Cache-Status', 'HIT_R2');

    return new Response(object.body, { headers });

  } catch (error) {
    logError(error, 'Proxy JIT failed', { key: key || 'unknown' });
    return new Response('Internal Error', { status: 500 });
  }
};
