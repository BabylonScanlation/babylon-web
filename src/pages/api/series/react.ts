import type { APIRoute } from 'astro';
import { z } from 'zod';

const ReactionSchema = z.object({
  seriesId: z.number().int().positive(),
  emoji: z.string().min(1).nullable(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
    });
  }

  try {
    const body = await request.json();
    const validation = ReactionSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), {
        status: 400,
      });
    }

    const { seriesId, emoji } = validation.data;
    const db = locals.runtime.env.DB;

    if (emoji) {
      // Si hay un emoji, lo inserta o reemplaza el existente para ese usuario y serie.
      await db
        .prepare(
          'INSERT OR REPLACE INTO SeriesReactions (series_id, user_id, reaction_emoji) VALUES (?, ?, ?)'
        )
        .bind(seriesId, user.uid, emoji)
        .run();
    } else {
      // Si el emoji es null, significa que el usuario quitó su reacción.
      await db
        .prepare(
          'DELETE FROM SeriesReactions WHERE series_id = ? AND user_id = ?'
        )
        .bind(seriesId, user.uid)
        .run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: unknown) {
    console.error('Error al registrar la reacción:', e);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
