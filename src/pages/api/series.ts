// src/pages/api/series.ts
import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';
import { series } from '../../db/schema';
import { getDB } from '../../lib/db';
import { logError } from '../../lib/logError';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const drizzleDb = getDB(locals.runtime.env);
    const results = await drizzleDb
      .select({
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

    const formattedResults = results.map((s) => ({
      ...s,
      coverImageUrl: s.coverImageUrl,
    }));

    return new Response(JSON.stringify(formattedResults), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    logError(error, 'Error al obtener las series');
    return new Response('Error al obtener las series', { status: 500 });
  }
};
