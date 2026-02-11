// src/pages/api/user/favorites-full.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { series, favorites } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET: Full details for Library page
export const GET: APIRoute = async ({ locals }) => {
  const { user } = locals;
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  try {
    const db = getDB(locals.runtime.env);
    
    // Fetch series favorites with join
    const seriesFavs = await db.select({
      id: favorites.id,
      createdAt: favorites.createdAt,
      series: {
        id: series.id,
        title: series.title,
        slug: series.slug,
        cover: series.coverImageUrl,
        views: series.views
      }
    })
    .from(favorites)
    .innerJoin(series, eq(favorites.seriesId, series.id))
    .where(and(eq(favorites.userId, user.uid), eq(favorites.type, 'series')))
    .orderBy(desc(favorites.createdAt));

    return new Response(JSON.stringify(seriesFavs), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Favorites Full GET Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
