import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { eq, inArray } from 'drizzle-orm';
import { chapters, series } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const db = getDB(env);

    // Buscar la serie por slug
    const seriesData = await db
      .select({ id: series.id, title: series.title })
      .from(series)
      .where(eq(series.slug, 'serie-486'))
      .get();

    if (!seriesData) {
      return new Response(JSON.stringify({ error: 'Serie no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Traer Capítulos 348 y 346 de toda la base de datos
    const data = await db
      .select({
        id: chapters.id,
        seriesId: chapters.seriesId,
        chapterNumber: chapters.chapterNumber,
        isNsfw: chapters.isNsfw,
        status: chapters.status,
        telegramFileId: chapters.telegramFileId,
        createdAt: chapters.createdAt,
      })
      .from(chapters)
      .where(inArray(chapters.chapterNumber, [346, 348]))
      .orderBy(chapters.chapterNumber, chapters.isNsfw)
      .all();

    return new Response(
      JSON.stringify({ total: data.length, chapters: data }, null, 2),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    return new Response((err as Error).message, { status: 500 });
  }
};
