import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { series, seriesRatings } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { logError } from '../../../lib/logError';

export const GET: APIRoute = async ({ locals }) => {
  const { user, runtime } = locals;

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const db = getDB(runtime.env);
    
    // Obtenemos todas las calificaciones del usuario con la info de la serie
    const ratedSeries = await db
      .select({
        rating: seriesRatings.rating,
        createdAt: seriesRatings.createdAt,
        series: {
          id: series.id,
          title: series.title,
          slug: series.slug,
          cover: series.coverImageUrl,
          views: series.views
        }
      })
      .from(seriesRatings)
      .innerJoin(series, eq(seriesRatings.seriesId, series.id))
      .where(eq(seriesRatings.userId, user.uid))
      .orderBy(desc(seriesRatings.createdAt))
      .all();

    return new Response(JSON.stringify(ratedSeries), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logError(error, 'Error al obtener calificaciones del usuario');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
