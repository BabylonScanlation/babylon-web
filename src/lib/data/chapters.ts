import type { ExecutionContext } from '@cloudflare/workers-types';
import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import { chapters, series } from '../../db/schema';
import type { BabylonEnv, ChapterManifest } from '../../types';
import { signManifest } from '../crypto';

// Orion: Memoria RAM local para peticiones cero (Isolate level)
const chapterMetadataMemoryCache = new Map<string, { data: any; expires: number }>();

export async function getChapterPayload(
  db: DrizzleD1Database<typeof schema>,
  env: BabylonEnv,
  slug: string,
  chapterNumber: number,
  ctx?: ExecutionContext
) {
  const CHAPTER_METADATA_KEY = `chapter_metadata_${slug}_${chapterNumber}`;
  const now = Date.now();

  let chapterData: any = null;

  // 1. RAM Cache (Peticiones Cero)
  const cached = chapterMetadataMemoryCache.get(CHAPTER_METADATA_KEY);
  if (cached && cached.expires > now) {
    chapterData = cached.data;
  }

  // 2. Si no hay cache, consultar D1
  if (!chapterData) {
    chapterData = await db
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

    // Guardar en RAM por 10 minutos (600,000 ms)
    if (chapterData) {
      chapterMetadataMemoryCache.set(CHAPTER_METADATA_KEY, {
        data: chapterData,
        expires: now + 600000,
      });
    }
  }

  if (!chapterData) return null;

  // Extraemos las tablas del join (Normalizamos si viene de cache o D1 directo)
  const chapter = chapterData.Chapters || chapterData.chapters;
  if (!chapter) return null;

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
