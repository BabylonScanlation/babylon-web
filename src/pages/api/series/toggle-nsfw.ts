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
  let isNsfw: boolean | undefined;

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const body = await request.json();
    seriesId = body.seriesId;
    isNsfw = body.isNsfw;

    if (seriesId === undefined || isNsfw === undefined) {
      return new Response(JSON.stringify({ message: 'seriesId and isNsfw are required' }), { status: 400 });
    }

    await drizzleDb.update(series)
      .set({ isNsfw: isNsfw })
      .where(eq(series.id, seriesId))
      .run();

    return new Response(JSON.stringify({ message: 'NSFW status updated successfully' }), { status: 200 });
  } catch (error: unknown) {
    logError(error, 'Error al cambiar el estado NSFW de la serie', { seriesId, isNsfw });
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
};
