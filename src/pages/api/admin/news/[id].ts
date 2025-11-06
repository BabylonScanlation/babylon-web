import type { APIRoute } from 'astro';
import { getDB, getNewsById, updateNews, deleteNews } from '../../../../src/lib/db';

export const GET: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const db = getDB(locals.runtime.env);
  const newsItem = await getNewsById(db, id);

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

  const db = getDB(locals.runtime.env);
  try {
    const updates = await request.json();
    const updatedNews = await updateNews(db, id, updates);

    if (!updatedNews) {
      return new Response('News item not found', { status: 404 });
    }

    return new Response(JSON.stringify(updatedNews), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error updating news item ${id}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const session = await getSession(request);
  if (!session || !locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response('News ID is required', { status: 400 });
  }

  const db = getDB(locals.runtime.env);
  try {
    const success = await deleteNews(db, id);
    if (!success) {
      return new Response('News item not found or could not be deleted', { status: 404 });
    }
    return new Response(null, { status: 204 }); // No Content
  } catch (error) {
    console.error(`Error deleting news item ${id}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
};