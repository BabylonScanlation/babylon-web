// src/pages/api/user/favorites-full.ts
import type { APIRoute } from 'astro';
import { and, desc, eq } from 'drizzle-orm';
import { favorites, series } from '../../../db/schema';
import { getDB } from '../../../lib/db';

// GET: Full details for Library page
export const GET: APIRoute = async ({ locals, cookies }) => {
  const { user } = locals;
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const isNsfwMode = cookies.get('babylon_nsfw')?.value === 'true';

  try {
    const db = getDB(locals.runtime.env);

    const conditions = [eq(favorites.userId, user.uid)];

    // Orion: Filtrado exclusivo por zona
    if (isNsfwMode) {
      conditions.push(eq(series.isNsfw, true));
    } else {
      conditions.push(eq(series.isNsfw, false));
    }

    // Fetch series favorites with join
    const seriesFavs = await db
      .select({
        id: favorites.id,
        createdAt: favorites.createdAt,
        series: {
          id: series.id,
          title: series.title,
          slug: series.slug,
          cover: series.coverImageUrl,
          views: series.views,
          isNsfw: series.isNsfw,
        },
      })
      .from(favorites)
      .innerJoin(series, eq(favorites.seriesId, series.id))
      .where(and(...conditions))
      .orderBy(desc(favorites.createdAt));

    return new Response(JSON.stringify(seriesFavs), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Favorites Full GET Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
