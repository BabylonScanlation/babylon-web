import type { APIRoute } from 'astro';

export const POST: APIRoute = async (context) => {
  const { request, cookies, redirect, locals } = context;
  const referer = request.headers.get('Referer') || '/admin/series';

  try {
    if (cookies.get('session')?.value !== 'admin-logged-in') {
      return redirect('/admin?error=No autorizado');
    }

    const db = locals.runtime.env.DB;
    const r2Cache = locals.runtime.env.R2_CACHE;
    const r2Assets = locals.runtime.env.R2_ASSETS;
    const formData = await request.formData();
    const seriesId = formData.get('seriesId');

    if (!seriesId) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set(
        'error',
        'ID de serie no encontrado para eliminar'
      );
      return redirect(errorUrl.toString());
    }

    const seriesData = await db
      .prepare('SELECT cover_image_url FROM Series WHERE id = ?')
      .bind(seriesId)
      .first<{ cover_image_url: string }>();
    const chapters = await db
      .prepare('SELECT id FROM Chapters WHERE series_id = ?')
      .bind(seriesId)
      .all<{ id: number }>();
    const chapterIds = chapters.results.map((c: { id: number }) => c.id);

    if (chapterIds.length > 0) {
      const pages = await db
        .prepare(
          `SELECT image_url FROM Pages WHERE chapter_id IN (${chapterIds.join(',')})`
        )
        .all<{ image_url: string }>();
      if (pages.results.length > 0) {
        const pageKeys = pages.results.map(
          (p: { image_url: string }) => p.image_url
        );
        await r2Cache.delete(pageKeys);
      }
    }

    if (
      seriesData &&
      seriesData.cover_image_url &&
      !seriesData.cover_image_url.includes('placeholder')
    ) {
      const coverKey = seriesData.cover_image_url.split('/').slice(3).join('/');
      await r2Assets.delete(coverKey);
    }

    await db.batch([
      db.prepare(
        `DELETE FROM Pages WHERE chapter_id IN (${chapterIds.join(',')})`
      ),
      db.prepare('DELETE FROM Chapters WHERE series_id = ?').bind(seriesId),
      db.prepare('DELETE FROM Series WHERE id = ?').bind(seriesId),
    ]);

    return redirect('/admin/series?success=Serie eliminada con éxito');
  } catch (e: any) {
    console.error('Error in API Delete Series endpoint:', e);
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set('error', `Error al eliminar serie: ${e.message}`);
    return redirect(errorUrl.toString());
  }
};
