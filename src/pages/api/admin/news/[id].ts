import type { APIRoute } from 'astro';
import { getDB, getNewsById, updateNews, deleteNews, getNewsImages, type NewsImageItem } from '../../../../lib/db';
import { logError } from '../../../../lib/logError';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const drizzleDb = getDB(locals.runtime.env);
  const newsItem = await getNewsById(drizzleDb, id);

  if (!newsItem) {
    return new Response('News item not found', { status: 404 });
  }

  return new Response(JSON.stringify(newsItem), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const drizzleDb = getDB(locals.runtime.env);
  try {
    const updates = await request.json();
    const updatedNews = await updateNews(drizzleDb, id, updates);

    if (!updatedNews) {
      return new Response('News item not found', { status: 404 });
    }

    return new Response(JSON.stringify(updatedNews), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(error, 'Error al actualizar noticia', { newsId: id, userId: locals.user?.uid });
    return new Response('Internal Server Error', { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const drizzleDb = getDB(locals.runtime.env);
  const r2Assets = locals.runtime.env.R2_ASSETS;

  try {
    // Step 1: Find images associated with the news item
    const images = await getNewsImages(drizzleDb, id);
    
    // Step 2: If images exist, delete them from R2
    if (images && images.length > 0) {
      const keys = images.map((img: NewsImageItem) => img.r2Key);
      await r2Assets.delete(keys);
    }

    // Step 3: Delete the news item from the database
    // The ON DELETE CASCADE constraint will handle deleting the NewsImage records
    const success = await deleteNews(drizzleDb, id);

    if (!success) {
      return new Response('News item not found or could not be deleted', {
        status: 404,
      });
    }
    
    return new Response(null, { status: 204 }); // No Content
  } catch (error) {
    const newsIdForLog = id;
    const userIdForLog = locals.user?.uid;
    logError(error, 'Error al eliminar noticia', { newsId: newsIdForLog, userId: userIdForLog });
    return new Response('Internal Server Error', { status: 500 });
  }
};
