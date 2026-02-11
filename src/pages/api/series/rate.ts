import type { APIRoute } from 'astro';
import { z } from 'zod';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { seriesRatings } from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

const RatingSchema = z.object({
  seriesId: z.number().int().positive(),
  rating: z.number().min(1).max(5).nullable(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: 'Acceso denegado. Debes iniciar sesión para calificar.' }), {
      status: 401,
    });
  }

  let seriesId: number | undefined;
  let rating: number | null | undefined;

  try {
    const body = await request.json();
    const validation = RatingSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Datos inválidos. La calificación debe ser válida.' }), {
        status: 400,
      });
    }

    ({ seriesId, rating } = validation.data);
    const drizzleDb = getDB(locals.runtime.env);

    if (rating) {
      // Inserta o reemplaza la votación del usuario para esa serie usando Drizzle.
      await drizzleDb.insert(seriesRatings)
        .values({ seriesId, userId: user.uid, rating: rating })
        .onConflictDoUpdate({
          target: [seriesRatings.seriesId, seriesRatings.userId],
          set: { rating: rating },
        })
        .run();
    } else {
      // Si el rating es null, el usuario quitó su voto usando Drizzle.
      await drizzleDb.delete(seriesRatings)
        .where(and(eq(seriesRatings.seriesId, seriesId), eq(seriesRatings.userId, user.uid)))
        .run();
    }

    // Calcular nuevas estadísticas
    const stats = await drizzleDb.select({
      avgRating: sql`AVG(${seriesRatings.rating})`,
      count: sql`COUNT(*)`
    })
    .from(seriesRatings)
    .where(eq(seriesRatings.seriesId, seriesId))
    .get();

    const newAverage = stats?.avgRating ? parseFloat(Number(stats.avgRating).toFixed(1)) : 0;
    const newCount = stats?.count || 0;

    return new Response(JSON.stringify({ success: true, newAverage, newCount }), { status: 200 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al registrar la calificación de la serie', { seriesId: seriesId, userId: userIdForLog, rating: rating });
    return new Response(JSON.stringify({ error: 'Ocurrió un error interno en el servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
