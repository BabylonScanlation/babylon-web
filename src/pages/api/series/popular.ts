// src/pages/api/series/popular.ts
import type { APIRoute } from 'astro';
import { getPopularSeries } from '../../../lib/data/series';
import { getDB } from '../../../lib/db';
import { logError } from '../../../lib/logError';

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const db = getDB(locals.runtime.env);
    const user = locals.user;
    const allowNsfw = user?.isNsfw || url.searchParams.get('nsfw') === 'true';

    const results = await getPopularSeries(db, allowNsfw, 5);

    return new Response(JSON.stringify(results), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache 1 hora para popularidad
      },
    });
  } catch (error) {
    logError(error, 'Error al obtener las series populares');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
