// src/pages/api/comments/delete.ts
import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { comments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({
  request,
  redirect,
  locals,
}) => {
  const referer = request.headers.get('Referer') || '/admin/comments';

  if (!locals.user?.isAdmin) {
    return redirect('/admin?error=No autorizado');
  }

  let commentId: string | undefined; // Declare commentId here

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const formData = await request.formData();
    commentId = formData.get('commentId')?.toString(); // Assign value here

    if (!commentId) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'ID de comentario no proporcionado');
      return redirect(errorUrl.toString());
    }

    await drizzleDb.delete(comments).where(eq(comments.id, parseInt(commentId))).run();

    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Comentario de capítulo eliminado');
    return redirect(successUrl.toString());
  } catch (e: unknown) {
    logError(e, 'Error al eliminar el comentario de capítulo', { commentId });
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set('error', 'Error al eliminar el comentario');
    return redirect(errorUrl.toString());
  }
};
