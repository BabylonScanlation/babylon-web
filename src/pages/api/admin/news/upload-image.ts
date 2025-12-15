import type { APIRoute } from 'astro';
import { getDB, addNewsImage } from 'src/lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { R2_ASSETS: r2Assets } = locals.runtime.env;
  if (!r2Assets) {
    return new Response('R2 storage not configured', { status: 500 });
  }
  const db = getDB(locals.runtime.env);

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const newsId = formData.get('newsId') as string;

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
    await addNewsImage(db, {
        newsId,
        r2Key,
        altText: 'Image for news ' + newsId, // Basic alt text
        displayOrder: 0 // Assuming one image per post for now
    });

    return new Response(JSON.stringify({ message: "Image uploaded and associated successfully", r2Key }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error uploading image to R2:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
