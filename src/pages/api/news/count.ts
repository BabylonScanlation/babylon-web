// src/pages/api/news/count.ts
import type { APIRoute } from 'astro';
import { eq, sql } from 'drizzle-orm';
import { news } from '../../../db/schema';
import { getDB } from '../../../lib/db';

// Cache en memoria del Worker (Persiste mientras el worker esté caliente)
let cachedCount: number | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 segundos

export const GET: APIRoute = async ({ locals }) => {
  const now = Date.now();

  // Orion: Si tenemos un valor reciente en memoria, lo devolvemos instantáneamente
  if (cachedCount !== null && (now - lastFetchTime) < CACHE_TTL) {
    return new Response(JSON.stringify({ count: cachedCount, cached: true }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=120' 
      },
    });
  }

  const drizzleDb = getDB(locals.runtime.env);

  try {
    const result = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(news)
      .where(eq(news.status, 'published'))
      .get();

    cachedCount = result?.count || 0;
    lastFetchTime = now;

    return new Response(JSON.stringify({ count: cachedCount }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=60' 
      },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ count: 0, error: 'DB Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
