// src/pages/api/comments/delete.ts

import { getDB } from '@lib/db';
import { logError } from '@lib/logError';
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { comments } from '@/db/schema';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const referer = request.headers.get('Referer') || '/admin/comments';

  // Permitir autenticación básica, la autorización fina se hace abajo
  if (!locals.user) {
    // Si es una petición API (JSON), devolver 401
    if (request.headers.get('Content-Type')?.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    return redirect('/admin?error=No autorizado');
  }

  let commentId: string | undefined;

  try {
    const contentType = request.headers.get('Content-Type') || '';
    console.log('[DEBUG DELETE] Content-Type recibido:', contentType);

    if (contentType.includes('application/json')) {
      const body = await request.json();
      commentId = body.commentId;
    } else {
      try {
        const formData = await request.formData();
        commentId = formData.get('commentId')?.toString();
      } catch (formDataError) {
        console.error('[DEBUG DELETE] Error leyendo FormData:', formDataError);
        // Si falla FormData y no era JSON, no podemos hacer nada
      }
    }

    if (!commentId) {
      if (contentType.includes('application/json'))
        return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400 });
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'ID de comentario no proporcionado');
      return redirect(errorUrl.toString());
    }

    const drizzleDb = getDB(locals.runtime.env);

    // Verificar propiedad antes de borrar
    const existing = await drizzleDb
      .select()
      .from(comments)
      .where(eq(comments.id, parseInt(commentId)))
      .get();

    if (!existing) {
      if (contentType.includes('application/json'))
        return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });
      return redirect(referer);
    }

    const isOwner = existing.userId === locals.user.uid;
    const isAdmin = locals.user.isAdmin;

    if (!isOwner && !isAdmin) {
      if (contentType.includes('application/json'))
        return new Response(JSON.stringify({ error: 'Prohibido' }), { status: 403 });
      return redirect('/admin?error=No tienes permisos');
    }

    await drizzleDb
      .update(comments)
      .set({ isDeleted: true })
      .where(eq(comments.id, parseInt(commentId)))
      .run();

    if (contentType.includes('application/json')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Comentario de capítulo eliminado');
    return redirect(successUrl.toString());
  } catch (e: unknown) {
    logError(e, 'Error al eliminar el comentario de capítulo', { commentId });
    if (request.headers.get('Content-Type')?.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set('error', 'Error al eliminar el comentario');
    return redirect(errorUrl.toString());
  }
};
