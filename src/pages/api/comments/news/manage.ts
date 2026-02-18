import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import { newsComments } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export const PUT: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    const { commentId, commentText } = await request.json();
    if (!commentId || !commentText) return new Response('Missing data', { status: 400 });

    const db = getDB(locals.runtime.env);
    
    // Ownership check
    const existing = await db.select().from(newsComments).where(eq(newsComments.id, commentId)).get();
    if (!existing) return new Response('Not found', { status: 404 });
    if (existing.userId !== user.uid) return new Response('Forbidden', { status: 403 });

    await db.update(newsComments)
      .set({ 
        commentText,
        updatedAt: new Date()
      })
      .where(eq(newsComments.id, commentId))
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch {
    return new Response('Error editing comment', { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    const { commentId } = await request.json();
    if (!commentId) return new Response('Missing ID', { status: 400 });

    const db = getDB(locals.runtime.env);
    const existing = await db.select().from(newsComments).where(eq(newsComments.id, commentId)).get();
    
    if (!existing) return new Response('Not found', { status: 404 });
    if (existing.userId !== user.uid && !user.isAdmin) return new Response('Forbidden', { status: 403 });

    await db.update(newsComments)
      .set({ isDeleted: true })
      .where(eq(newsComments.id, commentId))
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch {
    return new Response('Error deleting comment', { status: 500 });
  }
};
