import type { APIRoute } from 'astro';
import { z } from 'zod';

const RatingSchema = z.object({
  seriesId: z.number().int().positive(),
  rating: z.number().min(1).max(5).nullable(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = RatingSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
    }
    
    const { seriesId, rating } = validation.data;
    const db = locals.runtime.env.DB;

    if (rating) {
      // Inserta o reemplaza la votación del usuario para esa serie.
      await db.prepare(
        "INSERT OR REPLACE INTO SeriesRatings (series_id, user_id, rating) VALUES (?, ?, ?)"
      ).bind(seriesId, user.uid, rating).run();
    } else {
      // Si el rating es null, el usuario quitó su voto.
      await db.prepare(
        "DELETE FROM SeriesRatings WHERE series_id = ? AND user_id = ?"
      ).bind(seriesId, user.uid).run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e: any) {
    console.error("Error al registrar la calificación:", e);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
  }
};