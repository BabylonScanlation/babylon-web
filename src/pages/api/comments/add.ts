// src/pages/api/comments/add.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { comments } from '../../../db/schema';
import { getDB } from '../../../lib/db';
import { logError } from '../../../lib/logError';

const CommentSchema = z.object({
  chapterId: z.number().int().positive(),
  parentId: z.number().int().optional().nullable(),
  commentText: z
    .string()
    .min(1, 'El comentario no puede estar vacío.')
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

  let chapterId: number | undefined;
  let commentText: string | undefined;
  let parentId: number | null | undefined;

  try {
    const body = await request.json();
    const validation = CommentSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Datos inválidos.';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
      });
    }

    ({ chapterId, commentText, parentId } = validation.data);
    const drizzleDb = getDB(locals.runtime.env);

    const result = await drizzleDb
      .insert(comments)
      .values({
        chapterId,
        userId: user.uid,
        commentText,
        parentId,
      })
      .returning({ id: comments.id, createdAt: comments.createdAt })
      .get();

    const newComment = {
      id: result.id,
      commentText: commentText,
      parentId: parentId,
      createdAt: result.createdAt,
      username: user.username || user.displayName || user.email?.split('@')[0] || 'Usuario',
      avatarUrl: user.avatarUrl,
    };

    return new Response(JSON.stringify(newComment), { status: 201 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid; // user is in scope from the outer function
    logError(e, 'Error al añadir comentario de capítulo', {
      chapterId: chapterId,
      userId: userIdForLog,
    });
    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor al procesar el comentario.',
      }),
      { status: 500 }
    );
  }
};
