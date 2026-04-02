import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { getDB } from '../../../lib/db-client';
import { clearSessionCache } from '../../../lib/middlewares/auth';

export const POST: APIRoute = async ({ cookies, locals }) => {
  const { user, runtime } = locals;
  const current = cookies.get('babylon_nsfw')?.value === 'true';
  const newValue = !current;

  // 1. Persistencia en DB si está logueado (Copiado de ui.ts)
  if (user && runtime?.env?.DB) {
    try {
      const db = getDB(runtime.env);
      await db.update(users).set({ isNsfw: newValue }).where(eq(users.id, user.uid)).run();

      const sessionId = cookies.get('user_session')?.value;
      if (sessionId) clearSessionCache(sessionId);
    } catch (e) {
      console.error('[API toggle-nsfw Error]:', e);
    }
  }

  // 2. Cookie Global
  cookies.set('babylon_nsfw', newValue.toString(), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false, // Permitimos que el CSS lo lea instantáneamente
  });

  return new Response(JSON.stringify({ success: true, newValue }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
