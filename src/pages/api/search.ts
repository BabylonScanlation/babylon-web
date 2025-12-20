// src/pages/api/search.ts
import type { APIRoute } from 'astro';
import { logError } from '../../lib/logError';
import { getDB } from '../../lib/db';
import { series } from '../../db/schema';
import { eq, asc, like, and } from 'drizzle-orm';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const drizzleDb = getDB(locals.runtime.env);
    const query = url.searchParams.get('q');

    if (!query || query.trim() === '') {
      return new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
      });
    }

    const searchTerm = `%${query.trim()}%`;

    const results = await drizzleDb.select({
      slug: series.slug,
      title: series.title,
      coverImageUrl: series.coverImageUrl,
      description: series.description,
      views: series.views,
    })
      .from(series)
      .where(and(like(series.title, searchTerm), eq(series.isHidden, false)))
      .orderBy(asc(series.title))
      .all();

    const formattedResults = results.map(s => ({
      ...s,
      cover_image_url: s.coverImageUrl, // Mapear a nombre original para el front
    }));

    return new Response(JSON.stringify(formattedResults), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: unknown) {
    const queryForLog = url.searchParams.get('q'); // Re-extract or define before try
    logError(error, 'Error al realizar la búsqueda en la API', { query: queryForLog });
    return new Response('Error al realizar la búsqueda', { status: 500 });
  }
};
