// src/pages/api/news/count.ts
import type { APIRoute } from 'astro';
import { eq, sql } from 'drizzle-orm';
import { news } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const drizzleDb = getDB(locals.runtime.env);

  try {
    const result = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(news)
      .where(eq(news.status, 'published'))
      .get();

    return new Response(JSON.stringify({ count: result?.count || 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ count: 0, error: 'DB Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
