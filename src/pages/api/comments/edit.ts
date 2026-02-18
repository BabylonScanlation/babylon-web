import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { comments } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const { commentId, commentText } = await request.json();

    if (!commentId || !commentText) {
      return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
    }

    const db = getDB(locals.runtime.env);

    // Verificar que el usuario sea el dueño del comentario
    const existingComment = await db.select().from(comments).where(eq(comments.id, commentId)).get();

    if (!existingComment) {
      return new Response(JSON.stringify({ error: 'Comentario no encontrado' }), { status: 404 });
    }

    // Permitir editar si es el dueño O si es admin (opcional)
    const isOwner = existingComment.userId === locals.user.uid;
    
    if (!isOwner && !locals.user.isAdmin) {
       return new Response(JSON.stringify({ error: 'No tienes permiso para editar este comentario' }), { status: 403 });
    }

    await db.update(comments)
      .set({ 
        commentText: commentText,
        updatedAt: new Date()
      })
      .where(eq(comments.id, commentId))
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    logError(error, 'Error editando comentario de capítulo');
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};
