// src/pages/api/series.ts
import type { APIRoute } from 'astro';
import { logError } from '../../lib/logError';
import { getDB } from '../../lib/db';
import { series } from '../../db/schema';
import { eq, asc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const drizzleDb = getDB(locals.runtime.env);
    const results = await drizzleDb.select({
      slug: series.slug,
      title: series.title,
      coverImageUrl: series.coverImageUrl,
      description: series.description,
      views: series.views,
    })
      .from(series)
      .where(eq(series.isHidden, false))
      .orderBy(asc(series.title))
      .all();

    const formattedResults = results.map(s => ({
      ...s,
      cover_image_url: s.coverImageUrl,
    }));

    return new Response(JSON.stringify(formattedResults), {
      headers: {
        'content-type': 'application/json',
        // ✅ AÑADIDO: Evita que esta respuesta se guarde en caché
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    logError(error, 'Error al obtener las series');
    return new Response('Error al obtener las series', { status: 500 });
  }
};
