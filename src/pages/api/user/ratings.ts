import type { APIRoute } from 'astro';
import { and, desc, eq } from 'drizzle-orm';
import { series, seriesRatings } from '../../../db/schema';
import { getDB } from '../../../lib/db';
import { logError } from '../../../lib/logError';

export const GET: APIRoute = async ({ locals, cookies }) => {
  const { user, runtime } = locals;
  const isNsfwMode = cookies.get('babylon_nsfw')?.value === 'true';

  if (!user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const db = getDB(runtime.env);

    // Orion: Construir condiciones dinámicas
    const conditions = [
      eq(seriesRatings.userId, user.uid)
    ];

    if (isNsfwMode) {
      conditions.push(eq(series.isNsfw, true));
    } else {
      conditions.push(eq(series.isNsfw, false));
    }

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
          views: series.views,
        },
      })
      .from(seriesRatings)
      .innerJoin(series, eq(seriesRatings.seriesId, series.id))
      .where(and(...conditions))
      .orderBy(desc(seriesRatings.createdAt))
      .all();

    return new Response(JSON.stringify(ratedSeries), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(error, 'Error al obtener calificaciones del usuario');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
