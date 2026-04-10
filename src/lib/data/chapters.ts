import type { ExecutionContext } from '@cloudflare/workers-types';
import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import { chapters, series } from '../../db/schema';
import type { BabylonEnv, ChapterManifest } from '../../types';
import { signManifest } from '../crypto';
import { obfuscate } from '../obfuscator';

export async function getChapterPayload(
  db: DrizzleD1Database<typeof schema>,
  env: BabylonEnv,
  slug: string,
  chapterNumber: number,
  ctx?: ExecutionContext
) {
  const chapterData = await db
    .select()
    .from(chapters)
    .innerJoin(series, eq(chapters.seriesId, series.id))
    .where(
      and(
        eq(series.slug, slug),
        eq(chapters.chapterNumber, chapterNumber),
        inArray(chapters.status, ['live', 'app_only', 'processing'])
      )
    )
    .get();

  if (!chapterData) return null;

  // Extraemos las tablas del join
  const chapter = chapterData.Chapters;

  const manifestKey = `${slug}/${chapterNumber}/manifest.json`;
  let manifestContent: ChapterManifest | null = null;

  // Orion: Intentamos recuperar del Edge Cache primero
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
  // Añadimos un prefijo de versión a la URL de caché para forzar la invalidación global de los manifiestos antiguos
  const cacheUrl = `https://r2-cache.local/v2.1/${manifestKey}`;

  if (cache) {
    const cachedResponse = await cache.match(cacheUrl);
    if (cachedResponse) {
      manifestContent = await cachedResponse.json();
    }
  }

  // Orion: Si no hay cache, leemos de R2
  if (!manifestContent) {
    try {
      const manifestObject = await env.R2_CACHE.get(manifestKey);
      if (manifestObject) {
        manifestContent = await manifestObject.json();

        // Guardamos en cache para la próxima petición (24h)
        if (cache) {
          const response = new Response(JSON.stringify(manifestContent), {
            headers: { 'Cache-Control': 'public, max-age=86400' },
          });
          const cachePromise = cache.put(cacheUrl, response);
          if (ctx) ctx.waitUntil(cachePromise);
          else await cachePromise;
        }
      }
    } catch (e) {
      console.error('Error recuperando manifest de R2:', e);
    }
  }

  const salt = env.INTERNAL_CRYPTO_SALT;
  if (!salt) throw new Error('[SECURITY] INTERNAL_CRYPTO_SALT is not configured');
  if (manifestContent) {
    const signedManifest = await signManifest(manifestContent, env.AUTH_SECRET);
    return {
      payload: {
        ...signedManifest,
        seriesId: chapter.seriesId,
        chapterId: chapter.id,
        chapterCoverUrl: chapter.urlPortada,
      },
      processing: false,
      chapterId: chapter.id,
    };
  }

  return {
    payload: {
      status: 'processing',
      seriesId: chapter.seriesId,
      chapterId: chapter.id,
      chapterCoverUrl: chapter.urlPortada,
    },
    processing: true,
    chapterId: chapter.id,
  };
}
