import { env } from 'cloudflare:workers';
import { HttpReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { chapters, series } from '../../../db/schema';
import { verifySignature } from '../../../lib/crypto';
import { getDB } from '../../../lib/db-client';
import { logError } from '../../../lib/logError';

// ORION: Cache en memoria del Worker para evitar ráfagas de peticiones al mismo ZIP
const ZIP_CACHE = new Map<string, { filePath: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { key } = params;
  if (!key) return new Response('Key required', { status: 400 });

  const publicAssetsUrl = env.R2_PUBLIC_URL_ASSETS;

  // 0. PRE-CHECK: Evitar doble caché si la 'key' es una URL que ya pertenece a nuestro bucket de Assets
  if (key.includes('http') && publicAssetsUrl && key.includes(publicAssetsUrl)) {
    return Response.redirect(key, 302);
  }

  const R2Cache = env.R2_CACHE;

  const url = new URL(request.url);
  const expires = url.searchParams.get('expires');
  const signature = url.searchParams.get('signature');

  // 1. SEGURIDAD (Capa 0)
  const secret = (env.AUTH_SECRET || '')
    .trim()
    .replace(/['"“”]/g, '')
    .replace(/\\n/g, '');
  if (!secret || !expires || !signature) return new Response('Unauthorized', { status: 403 });

  const isValid = await verifySignature(`/api/r2-cache/${key}`, expires, signature, secret);
  if (!isValid) return new Response('Invalid Signature', { status: 403 });

  try {
    const etag = request.headers.get('If-None-Match');

    // 2. INTENTO DESDE R2_CACHE (Capa 1)
    const cachedObject = await R2Cache.get(key, {
      onlyIf: etag ? { etagMatches: etag } : undefined,
    });

    if (cachedObject) {
      if ('body' in cachedObject && !cachedObject.body) return new Response(null, { status: 304 });
      return new Response(cachedObject.body, {
        headers: {
          'Content-Type': cachedObject.httpMetadata?.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, s-maxage=2592000, immutable',
          ETag: cachedObject.httpEtag,
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Status': 'HIT_CACHE',
        },
      });
    }

    // 2.1. INTENTO DESDE R2_ASSETS (Capa 1.5) - Orion: Si está en Assets, servir y re-poblar Cache
    const R2Assets = env.R2_ASSETS;
    if (R2Assets) {
      const assetObject = await R2Assets.get(key, {
        onlyIf: etag ? { etagMatches: etag } : undefined,
      });
      if (assetObject) {
        if ('body' in assetObject && !assetObject.body) return new Response(null, { status: 304 });

        // Si tenemos el objeto en Assets, lo enviamos al usuario...
        const buffer = await assetObject.arrayBuffer();

        // ...y en segundo plano lo devolvemos al caché para futuras peticiones rápidas
        if (locals.cfContext?.waitUntil) {
          locals.cfContext.waitUntil(
            R2Cache.put(key, buffer, {
              httpMetadata: assetObject.httpMetadata,
            })
          );
        }

        return new Response(buffer, {
          headers: {
            'Content-Type': assetObject.httpMetadata?.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, s-maxage=2592000, immutable',
            ETag: assetObject.httpEtag,
            'Access-Control-Allow-Origin': '*',
            'X-Cache-Status': 'HIT_ASSETS_RECACHED',
          },
        });
      }
    }

    // 3. JIT RECOVERY DESDE TELEGRAM (Capa 2)
    const parts = key.split('/');
    let seriesSlug = '';
    let chapterNumStr = '';
    let chapterIdStr = '';
    let nsfwFolder = '';
    let filename = '';
    let isLegacyPath = false;

    if (parts[0] === 'series_manifest') {
      // Legacy structure: series_manifest / slug / chapterId / hash / filename
      if (parts.length < 5) return new Response('Not Found', { status: 404 });
      seriesSlug = parts[1] || '';
      chapterIdStr = parts[2] || '';
      filename = parts.slice(4).join('/');
      isLegacyPath = true;
    } else {
      // New structure: slug / chapterNumber / nsfwFolder(0 o 1) / filename (ej. 1.webp)
      if (parts.length < 4) return new Response('Not Found', { status: 404 });
      seriesSlug = parts[0] || '';
      chapterNumStr = parts[1] || '';
      nsfwFolder = parts[2] || '';
      filename = parts.slice(3).join('/');
    }

    const cacheKey = isLegacyPath
      ? `${seriesSlug}/legacy_${chapterIdStr}`
      : `${seriesSlug}/${chapterNumStr}/${nsfwFolder}`;

    let filePath = ZIP_CACHE.get(cacheKey)?.filePath;

    if (!filePath || Date.now() - (ZIP_CACHE.get(cacheKey)?.timestamp || 0) > CACHE_TTL) {
      const db = getDB(env);
      let chapter: { fileId: string | null } | undefined;

      if (isLegacyPath) {
        chapter = await db
          .select({ fileId: chapters.telegramFileId })
          .from(chapters)
          .where(eq(chapters.id, parseInt(chapterIdStr, 10)))
          .get();
      } else {
        const isNsfwBool = nsfwFolder === '1';
        chapter = await db
          .select({ fileId: chapters.telegramFileId })
          .from(chapters)
          .innerJoin(series, eq(chapters.seriesId, series.id))
          .where(
            and(
              eq(series.slug, seriesSlug),
              eq(chapters.chapterNumber, parseFloat(chapterNumStr)),
              eq(chapters.isNsfw, isNsfwBool)
            )
          )
          .get();
      }

      if (!chapter?.fileId) return new Response('Chapter source missing', { status: 404 });

      const tgInfo = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${chapter.fileId}`
      );
      const tgData = (await tgInfo.json()) as {
        ok: boolean;
        result?: { file_path: string };
      };
      if (!tgData.ok || !tgData.result?.file_path) throw new Error('TG Path Error');
      filePath = tgData.result.file_path;
      ZIP_CACHE.set(cacheKey, { filePath, timestamp: Date.now() });
    }

    const tgUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    const zipReader = new ZipReader(new HttpReader(tgUrl));
    const entries = await zipReader.getEntries();

    const entry = entries.find((e) => {
      const entryName = e.filename || '';

      if (isLegacyPath) {
        return (
          entryName.toLowerCase().includes(filename.toLowerCase()) ||
          filename.toLowerCase().includes(entryName.toLowerCase())
        );
      } else {
        // En la nueva estructura, extraemos el número real del archivo en el ZIP
        // y lo comparamos con el número solicitado (ej. 1.webp -> 1)
        const allNumbers = entryName.match(/(\d+)/g);
        if (!allNumbers || allNumbers.length === 0) return false;

        const lastNumber = allNumbers[allNumbers.length - 1] as string;
        const pageNumber = parseInt(lastNumber, 10);

        const targetPage = parseInt(filename.split('.')[0] || '0', 10);
        return pageNumber === targetPage;
      }
    });

    // biome-ignore lint/suspicious/noExplicitAny: zip.js entry property access requires casting
    if (!entry || !('getData' in entry) || typeof (entry as any).getData !== 'function') {
      await zipReader.close();
      return new Response('Page not found in ZIP', { status: 404 });
    }

    // biome-ignore lint/suspicious/noExplicitAny: zip.js getData method call requires casting
    const buffer = await (entry as any).getData(new Uint8ArrayWriter());
    await zipReader.close();

    const contentType = filename.toLowerCase().endsWith('.webp')
      ? 'image/webp'
      : filename.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

    // ORION: Solo guardamos en R2 si la KEY es una ruta limpia, no una URL completa.
    // Esto previene la creación de carpetas 'http' o 'https'.
    const isFullUrl = key.includes('://') || key.startsWith('http');

    if (locals.cfContext?.waitUntil && !isFullUrl) {
      locals.cfContext.waitUntil(
        R2Cache.put(key, buffer, {
          httpMetadata: {
            contentType,
            cacheControl: 'public, max-age=31536000, s-maxage=2592000, immutable',
          },
        })
      );
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, s-maxage=2592000, immutable',
        'X-Cache-Status': 'JIT_MISS',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    logError(err, '[R2 Proxy] Critical failure', { key });
    return new Response('Error loading image', { status: 500 });
  }
};
