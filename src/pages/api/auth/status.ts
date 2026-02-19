import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { userRoles, users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user || !user.uid) {
    return new Response(JSON.stringify(null), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  try {
    const db = getDB(locals.runtime.env);
    // Orion: Buscamos el usuario y su rol en D1
    const dbUser = await db.select().from(users).where(eq(users.id, user.uid)).get();
    const roleData = await db.select().from(userRoles).where(eq(userRoles.userId, user.uid)).get();

    const isAdmin = roleData?.role === 'admin' || user.isAdmin;

    const enrichedUser = {
      ...user,
      username: dbUser?.username || user.username,
      displayName: dbUser?.displayName || user.displayName,
      avatarUrl: dbUser?.avatarUrl,
      isAdmin: !!isAdmin,
      isNsfw: dbUser?.isNsfw || user.isNsfw,
    };

    return new Response(JSON.stringify(enrichedUser), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
      status: 200,
    });
  } catch (error) {
    console.error('[API Status] Error:', error);
    return new Response(JSON.stringify(user), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }
};
