// src/pages/api/upload-chapter-thumbnail.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { D1Database, R2Bucket } from '@cloudflare/workers-types'; // Assuming R2Bucket type is available

interface Env {
  DB: D1Database;
  R2_BUCKET_ASSETS: R2Bucket; // Assuming this is the binding for your assets R2 bucket
  R2_PUBLIC_URL_ASSETS: string; // Public URL for R2 assets
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDB(env);

  try {
    const formData = await request.formData();
    const chapterId = formData.get('chapterId');
    const thumbnailImage = formData.get('thumbnailImage');

    if (!chapterId || typeof chapterId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'chapterId is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!thumbnailImage || !(thumbnailImage instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'thumbnailImage is required and must be a file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar tipo de archivo (opcional, pero buena práctica)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(thumbnailImage.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image type. Only JPEG, PNG, WEBP are allowed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generar un nombre de archivo único para la miniatura
    const thumbnailKey = `chapter-thumbnails/${chapterId}-${Date.now()}.${thumbnailImage.name.split('.').pop()}`;

    // Subir la imagen a R2
    await env.R2_BUCKET_ASSETS.put(thumbnailKey, thumbnailImage.stream() as any, {
      httpMetadata: { contentType: thumbnailImage.type },
    });

    const thumbnailUrl = `${env.R2_PUBLIC_URL_ASSETS}/${thumbnailKey}`;

    // Actualizar D1 con la URL de la miniatura
    await db
      .prepare('UPDATE Chapters SET url_portada = ? WHERE id = ?')
      .bind(thumbnailUrl, parseInt(chapterId))
      .run();

    console.log(`[Manual Thumbnail Upload] Thumbnail URL updated for Chapter ID: ${chapterId}`);

    return new Response(
      JSON.stringify({ success: true, thumbnailUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Manual Thumbnail Upload] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};