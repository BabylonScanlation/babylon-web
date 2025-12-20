import type { APIRoute } from 'astro';
import { z } from 'zod';
import { logError } from '../../../../lib/logError';
import { getDB } from '../../../../lib/db';
import { seriesComments } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';

const EditSchema = z.object({
  commentId: z.number().int().positive(),
  commentText: z
    .string()
    .min(1, 'El comentario no puede estar vacío.')
    .max(1000, 'El comentario no puede exceder los 1000 caracteres.'),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user?.uid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
    });
  }

  let commentId: number | undefined;
  let commentText: string | undefined;

  try {
    const body = await request.json();
    const validation = EditSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage =
        validation.error.errors[0]?.message || 'Datos inválidos.';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
      });
    }

    ({ commentId, commentText } = validation.data);
    const drizzleDb = getDB(locals.runtime.env);

    // Primero, verificamos que el comentario pertenezca al usuario
    const comment = await drizzleDb
      .select({ userId: seriesComments.userId })
      .from(seriesComments)
      .where(eq(seriesComments.id, commentId))
      .get();

    if (!comment) {
      return new Response(
        JSON.stringify({ error: 'Comentario no encontrado' }),
        { status: 404 }
      );
    }

    if (comment.userId !== user.uid) {
      return new Response(
        JSON.stringify({
          error: 'No tienes permiso para editar este comentario',
        }),
        { status: 403 }
      );
    }

    // Si todo es correcto, actualizamos el comentario
    await drizzleDb
      .update(seriesComments)
      .set({ commentText })
      .where(and(eq(seriesComments.id, commentId), eq(seriesComments.userId, user.uid)))
      .run();

    const updatedComment = {
      id: commentId,
      comment_text: commentText, // Keep original naming for frontend compatibility if needed
    };

    return new Response(JSON.stringify(updatedComment), { status: 200 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al editar el comentario de serie', { commentId: commentId, userId: userIdForLog });
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
