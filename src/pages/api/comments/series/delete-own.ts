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
    return new Response(JSON.stringify({ error: 'Acceso denegado. Debes iniciar sesión.' }), {
      status: 401,
    });
  }

  let commentId: number | undefined;

  try {
    const body = await request.json();
    const validation = DeleteSchema.safeParse(body);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Datos inválidos. Falta el ID del comentario.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    commentId = validation.data.commentId;
    const drizzleDb = getDB(locals.runtime.env);

    // Verificamos que el comentario exista y pertenezca al usuario
    const comment = await drizzleDb
      .select({ userId: seriesComments.userId })
      .from(seriesComments)
      .where(eq(seriesComments.id, commentId))
      .get();

    if (!comment) {
      return new Response(JSON.stringify({ error: 'El comentario no fue encontrado o no te pertenece.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (comment.userId !== user.uid) {
      return new Response(
        JSON.stringify({
          error: 'No tienes permiso para eliminar este comentario',
        }),
        { status: 403 }
      );
    }

    // Si todo es correcto, "eliminamos" el comentario (Soft Delete)
    await drizzleDb
      .update(seriesComments)
      .set({ isDeleted: true })
      .where(and(eq(seriesComments.id, commentId), eq(seriesComments.userId, user.uid)))
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al eliminar el comentario de serie propio', { commentId: commentId, userId: userIdForLog });
    return new Response(JSON.stringify({ error: 'Ocurrió un error interno en el servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
