import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { favorites, users } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET: List favorites (optionally filtered by type)
export const GET: APIRoute = async ({ request, locals }) => {
  const { user } = locals;
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type') as 'series' | 'chapter' | null;

  try {
    const db = getDB(locals.runtime.env);
    
    const conditions = [eq(favorites.userId, user.uid)];
    if (type) {
      conditions.push(eq(favorites.type, type));
    }

    const results = await db.select()
      .from(favorites)
      .where(and(...conditions))
      .orderBy(desc(favorites.createdAt));

    return new Response(JSON.stringify(results), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Favorites GET Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};

// POST: Toggle Favorite
export const POST: APIRoute = async ({ request, locals }) => {
  const { user } = locals;
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  try {
    const body = await request.json();
    const { type } = body;
    const id = Number(body.id); // Ensure numeric ID

    if (!['series', 'chapter'].includes(type) || isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400 });
    }

    const db = getDB(locals.runtime.env);
    
    // --- Orion: Ensure User exists in D1 before adding favorite ---
    // This fixes the FOREIGN KEY constraint failed error
    const existingUser = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.id, user.uid))
      .get();

    if (!existingUser) {
      // Create a basic user profile on-the-fly
      await db.insert(users).values({
        id: user.uid,
        email: user.email || `${user.uid}@firebase.auth`,
        username: user.email ? user.email.split('@')[0] : `user_${user.uid.slice(0, 5)}`,
      }).onConflictDoNothing();
    }
    
    // Check if favorite exists
    let existing;
    if (type === 'series') {
      existing = await db.select().from(favorites).where(
        and(eq(favorites.userId, user.uid), eq(favorites.seriesId, id))
      ).get();
    } else {
      existing = await db.select().from(favorites).where(
        and(eq(favorites.userId, user.uid), eq(favorites.chapterId, id))
      ).get();
    }

    if (existing) {
      // Remove (Unfavorite)
      await db.delete(favorites).where(eq(favorites.id, existing.id));
      return new Response(JSON.stringify({ action: 'removed', id }), { status: 200 });
    } else {
      // Add (Favorite)
      await db.insert(favorites).values({
        userId: user.uid,
        type: type,
        seriesId: type === 'series' ? id : null,
        chapterId: type === 'chapter' ? id : null,
      });
      return new Response(JSON.stringify({ action: 'added', id }), { status: 201 });
    }

  } catch (error) {
    console.error('Favorites POST Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
