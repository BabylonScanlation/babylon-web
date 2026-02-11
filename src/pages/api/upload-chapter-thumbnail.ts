// src/pages/api/upload-chapter-thumbnail.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { chapters } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { logError } from '../../lib/logError';

interface Env {
  DB: D1Database;
  R2_BUCKET_ASSETS: R2Bucket;
  R2_PUBLIC_URL_ASSETS: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }
  const env = locals.runtime.env as Env;
  const drizzleDb = getDB(env);

  let chapterId: string | undefined;

  try {
    const formData = await request.formData();
    chapterId = formData.get('chapterId')?.toString();
    const thumbnailImage = formData.get('thumbnailImage');

    if (!chapterId || typeof chapterId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'El ID del capítulo es obligatorio y debe ser un texto válido.' }),
        { status: 400 }
      );
    }

    if (!thumbnailImage || !(thumbnailImage instanceof File)) {
      return new Response(
        JSON.stringify({
          error: 'thumbnailImage is required and must be a file',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(thumbnailImage.type)
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid image type. Only JPEG, PNG, WEBP are allowed.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const thumbnailKey = `chapter-thumbnails/${chapterId}-${Date.now()}.${thumbnailImage.name.split('.').pop()}`;

    await env.R2_BUCKET_ASSETS.put(
      thumbnailKey,
      await thumbnailImage.arrayBuffer(),
      {
        httpMetadata: { contentType: thumbnailImage.type },
      }
    );

    const thumbnailUrl = `${env.R2_PUBLIC_URL_ASSETS}/${thumbnailKey}`;

    await drizzleDb.update(chapters)
      .set({ urlPortada: thumbnailUrl })
      .where(eq(chapters.id, parseInt(chapterId)));

    return new Response(JSON.stringify({ success: true, thumbnailUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(error, 'Error en subida manual de miniatura', { chapterId });
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
