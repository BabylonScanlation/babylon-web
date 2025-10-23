import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({
  request,
  cookies,
  redirect,
  locals,
}) => {
  const referer = request.headers.get('Referer') || '/admin/series';

  if (cookies.get('session')?.value !== 'admin-logged-in') {
    return redirect('/admin?error=No autorizado');
  }

  try {
    const db = locals.runtime.env.DB;
    const r2Cache = locals.runtime.env.R2_CACHE;
    const formData = await request.formData();
    const chapterId = formData.get('chapterId')?.toString();

    if (!chapterId) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'ID de capítulo no proporcionado');
      return redirect(errorUrl.toString());
    }

    const pages = await db
      .prepare('SELECT image_url FROM Pages WHERE chapter_id = ?')
      .bind(chapterId)
      .all<{ image_url: string }>();

    if (pages.results.length > 0) {
      const pageKeys = pages.results.map(
        (p: { image_url: string }) => p.image_url
      );
      await r2Cache.delete(pageKeys);
    }

    await db.batch([
      db.prepare('DELETE FROM Pages WHERE chapter_id = ?').bind(chapterId),
      db.prepare('DELETE FROM Chapters WHERE id = ?').bind(chapterId),
    ]);

    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Capítulo eliminado con éxito');
    return redirect(successUrl.toString());
  } catch (e: unknown) {
    console.error('Error al eliminar el capítulo:', e);
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set(
      'error',
      `Error al eliminar el capítulo: ${(e instanceof Error ? e.message : String(e))}`
    );
    return redirect(errorUrl.toString());
  }
};
