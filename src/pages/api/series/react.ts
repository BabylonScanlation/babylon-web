import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { seriesReactions } from '../../../db/schema';
import { getDB } from '../../../lib/db';
import { logError } from '../../../lib/logError';

const ReactionSchema = z.object({
  seriesId: z.number().int().positive(),
  emoji: z.string().min(1).nullable(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(
      JSON.stringify({ error: 'Acceso denegado. Debes iniciar sesión para reaccionar.' }),
      {
        status: 401,
      }
    );
  }

  let seriesId: number | undefined;
  let emoji: string | null | undefined;

  try {
    const body = await request.json();
    const validation = ReactionSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos. Verifica el ID de la serie y el emoji.' }),
        {
          status: 400,
        }
      );
    }

    ({ seriesId, emoji } = validation.data);
    const drizzleDb = getDB(locals.runtime.env);

    if (emoji) {
      // Si hay un emoji, lo inserta o reemplaza el existente para ese usuario y serie usando Drizzle.
      await drizzleDb
        .insert(seriesReactions)
        .values({ seriesId, userId: user.uid, reactionEmoji: emoji })
        .onConflictDoUpdate({
          target: [seriesReactions.seriesId, seriesReactions.userId],
          set: { reactionEmoji: emoji },
        })
        .run();
    } else {
      // Si el emoji es null, significa que el usuario quitó su reacción usando Drizzle.
      await drizzleDb
        .delete(seriesReactions)
        .where(and(eq(seriesReactions.seriesId, seriesId), eq(seriesReactions.userId, user.uid)))
        .run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al registrar la reacción de la serie', {
      seriesId: seriesId,
      userId: userIdForLog,
      emoji: emoji,
    });
    return new Response(JSON.stringify({ error: 'Ocurrió un error interno en el servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
