// src/pages/api/update-series.ts
import type { APIRoute } from 'astro';
import { logError } from '../../lib/logError';
import { getDB } from '../../lib/db';
import { series } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async (context) => {
  const { request, redirect, locals } = context;
  const referer = request.headers.get('Referer') || '/admin/series';

  let seriesId: string | undefined; // Declare here
  let title: string | undefined;   // Declare here

  try {
    if (!locals.user?.isAdmin) {
      return redirect('/admin/series?error=No autorizado');
    }

    const drizzleDb = getDB(locals.runtime.env);
    const r2Assets = locals.runtime.env.R2_ASSETS;
    const r2PublicUrlAssets = locals.runtime.env.R2_PUBLIC_URL_ASSETS;

    const formData = await request.formData();
    seriesId = formData.get('seriesId')?.toString(); // Assign here
    title = formData.get('title')?.toString();     // Assign here
    const description = formData.get('description')?.toString();
    const coverImage = formData.get('coverImage');

    const status = formData.get('status')?.toString() || 'N/A';
    const type = formData.get('type')?.toString() || 'N/A';
    const genres = formData.get('genres')?.toString() || 'N/A';
    const author = formData.get('author')?.toString() || 'N/A';
    const artist = formData.get('artist')?.toString() || 'N/A';
    const publishedBy = formData.get('published_by')?.toString() || 'N/A';
    const alternativeNames = formData.get('alternative_names')?.toString() || 'N/A';
    const serializedBy = formData.get('serialized_by')?.toString() || 'N/A';
    const demographic = formData.get('demographic')?.toString() || 'N/A';
    const isHidden = formData.get('is_hidden') === 'on';

    if (!seriesId || !title || !description) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'Faltan datos en el formulario');
      return redirect(errorUrl.toString());
    }

    let coverImageUrlToUpdate: string | null = null;

    if (coverImage instanceof File && coverImage.size > 0) {
      const seriesData = await drizzleDb.select({ slug: series.slug })
        .from(series)
        .where(eq(series.id, parseInt(seriesId)))
        .get();
      if (seriesData) {
        const imageExtension = coverImage.name.split('.').pop() || 'jpg';
        const imageKey = `covers/${seriesData.slug}.${Date.now()}.${imageExtension}`;

        await r2Assets.put(imageKey, await coverImage.arrayBuffer(), {
          httpMetadata: { contentType: coverImage.type },
        });

        coverImageUrlToUpdate = `${r2PublicUrlAssets}/${imageKey}`;
      }
    }

    const updates: Record<string, any> = {
      title,
      description,
      status,
      type,
      genres,
      author,
      artist,
      publishedBy,
      alternativeNames,
      serializedBy,
      demographic,
      isHidden,
    };

    if (coverImageUrlToUpdate) {
      updates.coverImageUrl = coverImageUrlToUpdate;
    }

    await drizzleDb.update(series)
      .set(updates)
      .where(eq(series.id, parseInt(seriesId)))
      .run();

    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Serie actualizada con éxito');
    return redirect(successUrl.toString());
  } catch (e: unknown) {
    logError(e, 'Error al actualizar la serie', { seriesId, title }); // Use seriesId and title directly
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set(
      'error',
      `Error interno al actualizar la serie: ${e instanceof Error ? e.message : String(e)}`
    );
    return redirect(errorUrl.toString());
  }
};
