import type { ExecutionContext } from '@cloudflare/workers-types';
import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../../db/schema';
import { chapters, series } from '../../db/schema';
import type { BabylonEnv, ChapterManifest } from '../../types';
import { signManifest } from '../crypto';

// Orion: Memoria RAM local para peticiones cero (Isolate level)
const chapterMetadataMemoryCache = new Map<string, { data: unknown; expires: number }>();

export async function getChapterPayload(
  db: DrizzleD1Database<typeof schema>,
  env: BabylonEnv,
  slug: string,
  chapterNumber: number,
  options: { scanlationSlug?: string; chapterId?: number } = {},
  ctx?: ExecutionContext
) {
  console.log(`[getChapterPayload] 🛰️ Iniciando petición para ${slug} # ${chapterNumber}`);
  const { scanlationSlug, chapterId } = options;
  const CHAPTER_METADATA_KEY = `chapter_metadata_${slug}_${chapterNumber}_${scanlationSlug || 'any'}_${chapterId || 'any'}`;
  const now = Date.now();

  let chapterData: unknown = null;

  // 1. RAM Cache (Peticiones Cero)
  const cached = chapterMetadataMemoryCache.get(CHAPTER_METADATA_KEY);
  if (cached && cached.expires > now) {
    chapterData = cached.data;
  }

  // 2. Si no hay cache, consultar D1
  if (!chapterData) {
    const query = db
      .select()
      .from(chapters)
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .$dynamic();

    const conditions = [
      eq(series.slug, slug),
      inArray(chapters.status, ['live', 'app_only', 'processing']),
    ];

    if (chapterId) {
      conditions.push(eq(chapters.id, chapterId));
    } else {
      conditions.push(eq(chapters.chapterNumber, chapterNumber));
      if (scanlationSlug) {
        // Nota: Requeriría un join con scanlations si solo tenemos el slug
        // Por ahora, asumimos que si no hay ID, buscamos el número y filtramos por scanlationId si fuera necesario
      }
    }

    chapterData = await query.where(and(...conditions)).get();

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
  const data = chapterData as {
    Chapters?: typeof chapters.$inferSelect;
    chapters?: typeof chapters.$inferSelect;
  };
  const chapter = data.Chapters || data.chapters;

  if (!chapter) {
    console.warn(
      `[getChapterPayload] 🛑 Error: No se pudo extraer el objeto chapter de chapterData.`,
      { chapterData }
    );
    return null;
  }

  const manifestKey = `${slug}/${chapterNumber}/manifest.json`;
  let manifestContent: ChapterManifest | null = null;

  // Orion: Intentamos recuperar del Edge Cache primero
  const cache =
    typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
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
          ctx?.waitUntil?.(cache.put(cacheUrl, response));
        }
      } else if (import.meta.env.DEV && env.R2_PUBLIC_URL_CACHE) {
        // Fallback robusto en desarrollo: Si el bucket R2 local está vacío (ej. al borrar .wrangler),
        // intentamos descargar el manifest directamente de la URL pública de producción.
        const targetUrl = `${env.R2_PUBLIC_URL_CACHE}/${manifestKey}`;
        console.log(
          `[Lector - Fallback] R2_CACHE local vacío. Intentando descargar manifest desde: ${targetUrl}`
        );

        try {
          const fallbackRes = await fetch(targetUrl);
          if (fallbackRes.ok) {
            manifestContent = await fallbackRes.json();
            console.log(`[Lector - Fallback] ✅ Manifest recuperado de producción con éxito.`);
          } else {
            console.log(
              `[Lector - Fallback] ❌ Falló la descarga desde producción. HTTP Status: ${fallbackRes.status}`
            );
          }
        } catch (fetchErr) {
          console.error(`[Lector - Fallback] ❌ Error de red al intentar descargar:`, fetchErr);
        }
      }
    } catch (e) {
      console.error('[LIGHTSPEED] Error leyendo manifest de R2:', e);
    }
  }

  // Orion: Lógica de Auto-Recuperación (Healing)
  // Si llegamos aquí y no hay manifest, pero el capítulo existe en D1,
  // significa que el caché de R2 expiró (TTL 24h).
  // Devolvemos processing: true para que el componente Reader (Svelte)
  // se cargue e invoque a la API (/api/series/...) la cual ya tiene la lógica
  // de reconstrucción y bloqueo nativa.
  if (!manifestContent) {
    console.log(`[getChapterPayload] 🛠️ Entrando en modo Healing para ${slug}/${chapterNumber}.`);
    return {
      chapter,
      manifest: null,
      payload: null,
      chapterId: chapter.id,
      processing: true,
    };
  }

  // 4. Firmar URLs (Seguridad Nuclear)
  const signedManifest = await signManifest(manifestContent, env.AUTH_SECRET);

  return {
    chapter,
    manifest: signedManifest,
    payload: signedManifest,
    chapterId: chapter.id,
    processing: chapter.status === 'processing',
  };
}
