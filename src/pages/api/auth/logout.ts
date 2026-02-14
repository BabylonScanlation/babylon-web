import type { APIRoute } from 'astro';
import { getDB } from '@lib/db';
import { sessions } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { deleteSession } from '@lib/session';

export const POST: APIRoute = async (context) => {
  const { cookies, redirect, request, locals } = context;
  const sessionId = cookies.get('user_session')?.value;
  const db = getDB(locals.runtime.env);

  if (sessionId && db) {
    try {
      await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    } catch (e) {
      console.error('Error deleting session from DB on logout:', e);
    }
  }

  deleteSession(context as any);
  
  const accept = request.headers.get('accept');

    if (accept?.includes('application/json')) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return redirect('/');
};
