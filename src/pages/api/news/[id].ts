import type { APIRoute } from 'astro';
import { getDB, getNewsById, getNewsImages } from '../../../../src/lib/db';
import { logError } from '../../../../src/lib/logError';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const drizzleDb = getDB(locals.runtime.env);
  try {
    const newsItem = await getNewsById(drizzleDb, id);

    if (!newsItem || newsItem.status !== 'published') {
      return new Response('News item not found or not published', { status: 404 });
    }

    const images = await getNewsImages(drizzleDb, newsItem.id);
    const imageUrls = images.map(img => `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);

    return new Response(JSON.stringify({ ...newsItem, imageUrls }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(error, 'Error al obtener noticia pública', { newsId: id });
    return new Response('Internal Server Error', { status: 500 });
  }
};
