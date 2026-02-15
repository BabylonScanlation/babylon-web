// src/pages/api/comments/series/add.ts
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDB } from '../../../../lib/db';
import { seriesComments } from '../../../../db/schema';

const CommentSchema = z.object({
  seriesId: z.number().int().positive(),
  parentId: z.number().int().optional().nullable(), // Added nullable()
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

  // let seriesId: number | undefined;
  // let commentText: string | undefined;

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

    const { seriesId, commentText, parentId } = validation.data;
    const drizzleDb = getDB(locals.runtime.env);

    const result = await drizzleDb
      .insert(seriesComments)
      .values({
        seriesId,
        userId: user.uid,
        commentText,
        parentId,
      })
      .returning({ id: seriesComments.id, createdAt: seriesComments.createdAt })
      .get();

    const newComment = {
      id: result.id,
      createdAt: result.createdAt,
      commentText: commentText,
      parentId: parentId, // Return parentId
      userId: user.uid,
      username: user.displayName || user.email?.split('@')[0],
      avatarUrl: user.avatarUrl,
    };

    return new Response(JSON.stringify(newComment), { status: 201 });
  } catch (error) {
    console.error('Error adding comment:', error);
    return new Response(
      JSON.stringify({ error: 'Ocurrió un error interno en el servidor.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
