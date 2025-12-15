import type { APIRoute } from 'astro';
import { getDB, getNewsById, getNewsImages } from '../../../../src/lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const db = getDB(locals.runtime.env);
  try {
    const newsItem = await getNewsById(db, id);

    if (!newsItem || newsItem.status !== 'published') {
      return new Response('News item not found or not published', { status: 404 });
    }

    const images = await getNewsImages(db, newsItem.id);
    const imageUrls = images.map(img => `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);

    return new Response(JSON.stringify({ ...newsItem, imageUrls }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error fetching public news item ${id}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
