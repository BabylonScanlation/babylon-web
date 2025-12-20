// src/pages/api/series/popular.ts
import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { series } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

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
      .orderBy(desc(series.views))
      .limit(5)
      .all();

    const formattedResults = results.map(s => ({
      ...s,
      cover_image_url: s.coverImageUrl, // Mapear a nombre original para el front
    }));

    return new Response(JSON.stringify(formattedResults), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    logError(error, 'Error al obtener las series populares');
    return new Response('Error al obtener las series populares', {
      status: 500,
    });
  }
};
