import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { news } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  const drizzleDb = getDB(locals.runtime.env);
  try {
    const latestNews = await drizzleDb.select({
      id: news.id,
      createdAt: news.createdAt,
    })
    .from(news)
    .where(eq(news.status, 'published'))
    .orderBy(desc(news.createdAt))
    .limit(10)
    .all();

    // Convert Date objects to numeric timestamps for easier comparison in JS
    const formattedNews = latestNews.map(n => ({
      id: n.id,
      createdAt: n.createdAt instanceof Date ? n.createdAt.getTime() : new Date(n.createdAt).getTime()
    }));

    return new Response(JSON.stringify(formattedNews), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
