// src/pages/api/comments/series/add.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { logError } from '../../../../lib/logError';
import { getDB } from '../../../../lib/db';
import { seriesComments } from '../../../../db/schema';

const CommentSchema = z.object({
  seriesId: z.number().int().positive(),
  commentText: z
    .string()
    .min(1, 'El comentario не puede estar vacío.')
    .max(1000, 'El comentario no puede exceder los 1000 caracteres.'),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;

  // ✅ CORRECCIÓN: Se valida solo el UID del usuario, no el email.
  if (!user || !user.uid) {
    return new Response(
      JSON.stringify({
        error: 'No autorizado. Debes iniciar sesión para comentar.',
      }),
      { status: 401 }
    );
  }

  let seriesId: number | undefined;
  let commentText: string | undefined;

  try {
    const body = await request.json();
    const validation = CommentSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage =
        validation.error.errors[0]?.message || 'Datos inválidos.';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
      });
    }

    ({ seriesId, commentText } = validation.data);
    const drizzleDb = getDB(locals.runtime.env);

    // ✅ CORRECCIÓN: Se proporciona un email alternativo si no está disponible.
    const userEmail = user.email || `user-${user.uid.substring(0, 8)}`;

    const result = await drizzleDb
      .insert(seriesComments)
      .values({
        seriesId,
        userId: user.uid,
        userEmail,
        commentText,
      })
      .returning({ id: seriesComments.id, createdAt: seriesComments.createdAt })
      .get();

    const newComment = {
      id: result.id,
      user_email: userEmail,
      comment_text: commentText,
      created_at: result.createdAt,
    };

    return new Response(JSON.stringify(newComment), { status: 201 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al añadir comentario de serie', { seriesId: seriesId, userId: userIdForLog });
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor.' }),
      { status: 500 }
    );
  }
};
