// src/pages/api/comments/series/delete-own.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { logError } from '../../../../lib/logError';
import { getDB } from '../../../../lib/db';
import { seriesComments } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';

const DeleteSchema = z.object({
  commentId: z.number().int().positive(),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
    });
  }

  let commentId: number | undefined;

  try {
    const body = await request.json();
    const validation = DeleteSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), {
        status: 400,
      });
    }

    ({ commentId } = validation.data);
    const drizzleDb = getDB(locals.runtime.env);

    // Verificamos que el comentario exista y pertenezca al usuario
    const comment = await drizzleDb
      .select({ userId: seriesComments.userId })
      .from(seriesComments)
      .where(eq(seriesComments.id, commentId))
      .get();

    console.log('Server user.uid:', user.uid);
    console.log('Comment user_id:', comment?.userId);

    if (!comment) {
      return new Response(
        JSON.stringify({ error: 'Comentario no encontrado' }),
        { status: 404 }
      );
    }

    if (comment.userId !== user.uid) {
      return new Response(
        JSON.stringify({
          error: 'No tienes permiso para eliminar este comentario',
        }),
        { status: 403 }
      );
    }

    // Si todo es correcto, eliminamos el comentario
    await drizzleDb
      .delete(seriesComments)
      .where(and(eq(seriesComments.id, commentId), eq(seriesComments.userId, user.uid)))
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al eliminar el comentario de serie propio', { commentId: commentId, userId: userIdForLog });
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
