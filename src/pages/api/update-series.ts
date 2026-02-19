// src/pages/api/update-series.ts
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { series } from '../../db/schema';
import { getDB } from '../../lib/db';
import { logError } from '../../lib/logError';

export const POST: APIRoute = async (context) => {
  const { request, redirect, locals } = context;

  let seriesId: string | undefined;
  let title: string | undefined;

  try {
    if (!locals.user?.isAdmin) {
      return redirect('/admin/series?error=No autorizado');
    }

    const drizzleDb = getDB(locals.runtime.env);
    const r2Assets = locals.runtime.env.R2_ASSETS;

    const formData = await request.formData();

    seriesId = formData.get('seriesId')?.toString();
    title = formData.get('title')?.toString();
    const description = formData.get('description')?.toString();
    let slug = formData.get('slug')?.toString().trim();
    const coverImage = formData.get('coverImage');

    if (!seriesId || !title || !description) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos obligatorios (ID, Título o Descripción)' }),
        { status: 400 }
      );
    }

    // Orion: Lógica Inteligente de Slugs
    const currentSeries = await drizzleDb
      .select()
      .from(series)
      .where(eq(series.id, parseInt(seriesId)))
      .get();

    if (currentSeries) {
      if (slug && slug !== currentSeries.slug) {
        slug = slug
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      } else if (currentSeries.slug.startsWith('serie-') && title !== currentSeries.title) {
        slug = title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      } else {
        slug = currentSeries.slug;
      }
    } else {
      return new Response(JSON.stringify({ error: 'Serie no encontrada' }), { status: 404 });
    }

    const status = formData.get('status')?.toString();
    const type = formData.get('type')?.toString();
    const genres = formData.get('genres')?.toString();
    const author = formData.get('author')?.toString();
    const artist = formData.get('artist')?.toString();
    const publishedBy = formData.get('publishedBy')?.toString();
    const alternativeNames = formData.get('alternativeNames')?.toString();
    const serializedBy = formData.get('serializedBy')?.toString();
    const demographic = formData.get('demographic')?.toString();

    const isHidden = formData.get('isHidden') === 'on';
    const isNsfw = formData.get('isNsfw') === 'on';
    const isAppSeries = formData.get('isAppSeries') === 'on';

    let coverImageUrlToUpdate: string | null = null;

    if (coverImage instanceof File && coverImage.size > 0) {
      const imageExtension = coverImage.name.split('.').pop() || 'jpg';
      const imageKey = `covers/${slug}.${Date.now()}.${imageExtension}`;
      const buffer = await coverImage.arrayBuffer();

      await r2Assets.put(imageKey, buffer, {
        httpMetadata: { contentType: coverImage.type },
      });
      coverImageUrlToUpdate = imageKey;
    }

    await drizzleDb
      .update(series)
      .set({
        title,
        slug,
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
        isNsfw,
        isAppSeries,
        ...(coverImageUrlToUpdate ? { coverImageUrl: coverImageUrlToUpdate } : {}),
      })
      .where(eq(series.id, parseInt(seriesId)))
      .run();

    return new Response(JSON.stringify({ success: true, message: 'Serie actualizada con éxito' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    logError(e, 'Error al actualizar la serie', { seriesId, title });
    return new Response(
      JSON.stringify({ error: `Error interno: ${e instanceof Error ? e.message : String(e)}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
