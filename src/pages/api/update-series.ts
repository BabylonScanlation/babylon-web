// src/pages/api/update-series.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async (context) => {
  const { request, cookies, redirect, locals } = context;
  const referer = request.headers.get('Referer') || '/admin/series';

  try {
    if (cookies.get('session')?.value !== 'admin-logged-in') {
      return redirect('/admin/series?error=No autorizado');
    }

    const db = locals.runtime.env.DB;
    const r2Assets = locals.runtime.env.R2_ASSETS;
    const r2PublicUrlAssets = locals.runtime.env.R2_PUBLIC_URL_ASSETS;

    const formData = await request.formData();
    const seriesId = formData.get('seriesId')?.toString();
    const title = formData.get('title')?.toString();
    const description = formData.get('description')?.toString();
    const coverImage = formData.get('coverImage');
    
    // ✅ OBTENER TODOS LOS CAMPOS DEL ESQUEMA UNIFICADO
    const status = formData.get('status')?.toString() || 'N/A';
    const type = formData.get('type')?.toString() || 'N/A';
    const genres = formData.get('genres')?.toString() || 'N/A';
    const author = formData.get('author')?.toString() || 'N/A';
    const artist = formData.get('artist')?.toString() || 'N/A';
    const published_by = formData.get('published_by')?.toString() || 'N/A';
    const alternative_names = formData.get('alternative_names')?.toString() || 'N/A';
    const serialized_by = formData.get('serialized_by')?.toString() || 'N/A';

    if (!seriesId || !title || !description) {
      const errorUrl = new URL(referer);
      errorUrl.searchParams.set('error', 'Faltan datos en el formulario');
      return redirect(errorUrl.toString());
    }

    let coverImageUrlToUpdate: string | null = null;

    if (coverImage instanceof File && coverImage.size > 0) {
      const series = await db.prepare("SELECT slug FROM Series WHERE id = ?").bind(seriesId).first<{ slug: string }>();
      if (series) {
        const imageExtension = coverImage.name.split('.').pop() || 'jpg';
        const imageKey = `covers/${series.slug}.${Date.now()}.${imageExtension}`;
        
        await r2Assets.put(imageKey, await coverImage.arrayBuffer(), {
          httpMetadata: { contentType: coverImage.type },
        });
        
        coverImageUrlToUpdate = `${r2PublicUrlAssets}/${imageKey}`;
      }
    }

    // ✅ CONSTRUIR LA CONSULTA DINÁMICAMENTE CON TODOS LOS CAMPOS
    let setClauses = "title = ?, description = ?, status = ?, type = ?, genres = ?, author = ?, artist = ?, published_by = ?, alternative_names = ?, serialized_by = ?";
    let bindParams: (string | number | null)[] = [title, description, status, type, genres, author, artist, published_by, alternative_names, serialized_by];

    if (coverImageUrlToUpdate) {
        setClauses += ", cover_image_url = ?";
        bindParams.push(coverImageUrlToUpdate);
    }
    
    bindParams.push(parseInt(seriesId));

    const updateQuery = `UPDATE Series SET ${setClauses} WHERE id = ?`;

    await db.prepare(updateQuery).bind(...bindParams).run();
    
    const successUrl = new URL(referer);
    successUrl.searchParams.set('success', 'Serie actualizada con éxito');
    return redirect(successUrl.toString());

  } catch (e: any) {
    console.error("Error al actualizar la serie:", e);
    const errorUrl = new URL(referer);
    errorUrl.searchParams.set('error', `Error interno al actualizar la serie: ${e.message}`);
    return redirect(errorUrl.toString());
  }
};