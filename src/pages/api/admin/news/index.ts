import type { APIRoute } from 'astro';
import { getDB, getAllNews, createNews } from '../../../../src/lib/db';

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = getDB(locals.runtime.env);
  const news = await getAllNews(db);
  return new Response(JSON.stringify(news), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = getDB(locals.runtime.env);
  try {
    const { title, content, status, seriesId } = await request.json(); // Added seriesId
    if (!title || !content || !status) {
      return new Response('Missing required fields', { status: 400 });
    }

    const newNews = await createNews(db, {
      title,
      content,
      publishedBy: locals.user.uid, // Assuming uid is the admin identifier
      status,
      seriesId: seriesId || null, // Pass seriesId
    });

    return new Response(JSON.stringify(newNews), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating news:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};