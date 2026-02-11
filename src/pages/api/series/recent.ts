// src/pages/api/series/recent.ts
import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { getRecentSeries } from '../../../lib/data/series';

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const db = getDB(locals.runtime.env);
    const user = locals.user;
    const allowNsfw = user?.isNsfw || url.searchParams.get('nsfw') === 'true';

    const results = await getRecentSeries(db, allowNsfw, 1000);

    return new Response(JSON.stringify(results), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'public, max-age=600', // Cache 10 min para recientes
      },
    });
  } catch (error) {
    logError(error, 'Error al obtener las series más recientes');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
};