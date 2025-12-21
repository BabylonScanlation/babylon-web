import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { series } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '../../../lib/logError';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }
  let seriesId: number | undefined;
  let isAppSeries: boolean | undefined;

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const body = await request.json();
    seriesId = body.seriesId;
    isAppSeries = body.isAppSeries;

    if (seriesId === undefined || isAppSeries === undefined) {
      return new Response(JSON.stringify({ message: 'seriesId and isAppSeries are required' }), { status: 400 });
    }

    await drizzleDb.update(series)
      .set({ isAppSeries: isAppSeries })
      .where(eq(series.id, seriesId));

    return new Response(JSON.stringify({ message: 'App series status updated successfully' }), { status: 200 });
  } catch (error: unknown) {
    logError(error, 'Error al cambiar el estado de serie de app', { seriesId: seriesId, isAppSeries: isAppSeries });
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
};
