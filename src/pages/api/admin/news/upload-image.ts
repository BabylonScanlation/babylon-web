import type { APIRoute } from 'astro';
import { getDB, addNewsImage } from '../../../../lib/db';
import { logError } from '../../../../lib/logError';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { R2_ASSETS: r2Assets } = locals.runtime.env;
  if (!r2Assets) {
    return new Response('R2 storage not configured', { status: 500 });
  }
  const drizzleDb = getDB(locals.runtime.env);
  let newsId: string | undefined;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    newsId = formData.get('newsId') as string;

    if (!file || !newsId) {
      return new Response('Image file and newsId are required', { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const r2Key = `news/${newsId}/${crypto.randomUUID()}.${fileExtension}`;

    await r2Assets.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
    // Associate image with the news item in the database
    await addNewsImage(drizzleDb, {
        newsId,
        r2Key,
        altText: 'Image for news ' + newsId, // Basic alt text
        displayOrder: 0 // Assuming one image per post for now
    });

    return new Response(JSON.stringify({ message: "Image uploaded and associated successfully", r2Key }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const userIdForLog = locals.user?.uid;
    logError(error, 'Error al subir imagen de noticia a R2', { newsId: newsId, userId: userIdForLog });
    return new Response('Internal Server Error', { status: 500 });
  }
};
