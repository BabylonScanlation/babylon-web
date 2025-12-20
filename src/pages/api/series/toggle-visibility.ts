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
  let isHidden: boolean | undefined;

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const body = await request.json();
    seriesId = body.seriesId;
    isHidden = body.isHidden;


    if (seriesId === undefined || isHidden === undefined) {
      return new Response(JSON.stringify({ message: 'seriesId and isHidden are required' }), { status: 400 });
    }

    await drizzleDb.update(series)
      .set({ isHidden: isHidden })
      .where(eq(series.id, seriesId));

    return new Response(JSON.stringify({ message: 'Visibility updated successfully' }), { status: 200 });
  } catch (error: unknown) {
    logError(error, 'Error al cambiar la visibilidad de la serie', { seriesId: seriesId, isHidden: isHidden });
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
};
