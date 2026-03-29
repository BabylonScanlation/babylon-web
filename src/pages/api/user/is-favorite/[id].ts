import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { favorites } from '../../../../db/schema';
import { getDB } from '../../../../lib/db-client';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const { user, runtime } = locals;

  if (!user) {
    return new Response(JSON.stringify({ isFavorite: false }), { status: 200 });
  }

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });
  }

  try {
    const db = getDB(runtime.env);
    const seriesId = parseInt(id);

    const existing = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, user.uid),
          eq(favorites.seriesId, seriesId),
          eq(favorites.type, 'series')
        )
      )
      .get();

    return new Response(JSON.stringify({ isFavorite: !!existing }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
