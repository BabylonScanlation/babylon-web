import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { news } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  const drizzleDb = getDB(locals.runtime.env);
  try {
    let latestNews;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        latestNews = await drizzleDb.select({
          id: news.id,
          createdAt: news.createdAt,
        })
        .from(news)
        .where(eq(news.status, 'published'))
        .orderBy(desc(news.createdAt))
        .limit(10)
        .all();
        break;
      } catch (dbErr) {
        attempts++;
        if (attempts >= maxAttempts) throw dbErr;
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempts - 1)));
      }
    }

    if (!latestNews) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });

    // Convert Date objects to numeric timestamps safely
    const formattedNews = latestNews.map(n => {
      let ts = 0;
      if (n.createdAt instanceof Date) {
        ts = n.createdAt.getTime();
      } else if (typeof n.createdAt === 'number') {
        ts = n.createdAt;
      } else {
        ts = new Date(n.createdAt).getTime();
      }
      return { id: n.id, createdAt: ts };
    });

    return new Response(JSON.stringify(formattedNews), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[API_NEWS_CHECK] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
