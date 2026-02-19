import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { chapters, series } from '../../db/schema';
import { getDB } from '../../lib/db';
import { logError } from '../../lib/logError';

export const POST: APIRoute = async (context) => {
  const { request, redirect, locals } = context;
  const referer = request.headers.get('Referer') || '/admin/series';

  let seriesId: string | undefined; // Declare seriesId here

  try {
    if (!locals.user?.isAdmin) {
      return redirect('/admin?error=No autorizado');
    }

    const drizzleDb = getDB(locals.runtime.env);
    const r2Cache = locals.runtime.env.R2_CACHE;
    const r2Assets = locals.runtime.env.R2_ASSETS;
    const formData = await request.formData();
    seriesId = formData.get('seriesId')?.toString(); // Assign value here

    if (!seriesId) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'ID de serie no encontrado para eliminar');
      return redirect(errorUrl.toString());
    }

    const seriesData = await drizzleDb
      .select({ coverImageUrl: series.coverImageUrl, slug: series.slug }) // Select slug as well for R2 key
      .from(series)
      .where(eq(series.id, parseInt(seriesId)))
      .get();

    // If the series has a slug, delete all its associated chapter assets from R2 Cache
    if (seriesData?.slug) {
      let truncated = true;
      let cursor: string | undefined;

      while (truncated) {
        const list = await r2Cache.list({
          prefix: `${seriesData.slug}/`,
          cursor,
        });

        const keys = list.objects.map((obj: { key: string }) => obj.key);
        if (keys.length > 0) {
          await r2Cache.delete(keys);
        }

        truncated = list.truncated;
        cursor = list.truncated ? list.cursor : undefined;
      }
    }

    if (
      seriesData &&
      seriesData.coverImageUrl &&
      !seriesData.coverImageUrl.includes('placeholder')
    ) {
      const coverKey = seriesData.coverImageUrl.split('/').pop(); // The key is just the last part of the URL
      if (coverKey) {
        await r2Assets.delete(coverKey);
      }
    }

    // First, delete chapters linked to the series
    await drizzleDb
      .delete(chapters)
      .where(eq(chapters.seriesId, parseInt(seriesId)))
      .run();

    // Finally, delete the series itself
    await drizzleDb
      .delete(series)
      .where(eq(series.id, parseInt(seriesId)))
      .run();

    return redirect('/admin/series?success=Serie eliminada con éxito');
  } catch (e: unknown) {
    logError(e, 'Error en el endpoint de la API para eliminar serie', { seriesId });
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set(
      'error',
      `Error al eliminar serie: ${e instanceof Error ? e.message : String(e)}`
    );
    return redirect(errorUrl.toString());
  }
};
