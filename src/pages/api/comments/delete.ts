// src/pages/api/comments/delete.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const referer = request.headers.get('Referer') || '/admin/comments';

  if (cookies.get('session')?.value !== 'admin-logged-in') {
    return redirect('/admin?error=No autorizado');
  }

  try {
    const db = locals.runtime.env.DB;
    const formData = await request.formData();
    const commentId = formData.get('commentId')?.toString();

    if (!commentId) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'ID de comentario no proporcionado');
      return redirect(errorUrl.toString());
    }

    await db.prepare("DELETE FROM Comments WHERE id = ?").bind(commentId).run();

    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Comentario de capítulo eliminado');
    return redirect(successUrl.toString());

  } catch (e: any) {
    console.error("Error al eliminar el comentario de capítulo:", e);
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set('error', 'Error al eliminar el comentario');
    return redirect(errorUrl.toString());
  }
};