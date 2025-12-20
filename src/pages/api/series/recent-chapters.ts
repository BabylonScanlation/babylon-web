import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { series, chapters } from '../../../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm'; // Added sql

export const GET: APIRoute = async (context) => {
  let twoDaysAgo: string | undefined;
  try {
    const drizzleDb = getDB(context.locals.runtime.env);
    twoDaysAgo = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString();

    const recentChapters = await drizzleDb.select({
        slug: series.slug,
        title: series.title,
        coverImageUrl: series.coverImageUrl,
        chapterNumber: chapters.chapterNumber,
        createdAt: chapters.createdAt,
      })
      .from(chapters)
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .where(and(eq(chapters.status, 'live'), sql`${chapters.createdAt} >= ${twoDaysAgo}`, eq(series.isHidden, false)))
      .orderBy(series.slug, desc(chapters.createdAt))
      .all();

    const seriesMap = new Map();
    for (const chapter of recentChapters) {
      if (!seriesMap.has(chapter.slug)) {
        seriesMap.set(chapter.slug, {
          slug: chapter.slug,
          title: chapter.title,
          cover_image_url: chapter.coverImageUrl, // Usar coverImageUrl de Drizzle
          chapters: [],
        });
      }
      const seriesEntry = seriesMap.get(chapter.slug);
      if (seriesEntry.chapters.length < 2) {
        seriesEntry.chapters.push({
          number: chapter.chapterNumber, // Usar chapterNumber de Drizzle
          createdAt: chapter.createdAt,
        });
      }
    }
    const seriesWithRecentChapters = Array.from(seriesMap.values()).sort(
      (a, b) => {
        const dateA = new Date(a.chapters[0].createdAt).getTime();
        const dateB = a.chapters.length > 0 ? new Date(b.chapters[0].createdAt).getTime() : 0;
        return dateB - dateA;
      }
    );

    return new Response(JSON.stringify(seriesWithRecentChapters), {
      headers: {
        'content-type': 'application/json',
        // ✅ AÑADIDO: Evita que esta respuesta se guarde en caché
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    logError(error, 'Error al obtener las series con capítulos recientes', { twoDaysAgo: twoDaysAgo });
    return new Response('Error al obtener las series con capítulos recientes', {
      status: 500,
    });
  }
};
