// src/pages/api/admin/series-with-chapters.ts

import { getAdminSeriesWithChapters } from '@lib/data/admin';
import { getDB } from '@lib/db';
import { logError } from '@lib/logError';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.user?.isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  const limit = limitParam ? parseInt(limitParam, 10) : 12;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  try {
    const drizzleDb = getDB(locals.runtime.env);

    // Orion: Reutilizamos la función modular de alto rendimiento
    const data = await getAdminSeriesWithChapters(drizzleDb, limit, offset, false);

    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    logError(error, 'Error en API admin/series-with-chapters');
    return new Response(JSON.stringify({ error: 'Internal Error' }), { status: 500 });
  }
};
