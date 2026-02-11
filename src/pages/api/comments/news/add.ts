import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import { newsComments } from '../../../../db/schema';
import { z } from 'zod';

const CommentSchema = z.object({
  newsId: z.string().uuid(),
  parentId: z.number().int().optional().nullable(),
  commentText: z.string().min(1).max(1000),
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const validation = CommentSchema.safeParse(body);
    if (!validation.success)
      return new Response('Invalid data', { status: 400 });

    const { newsId, commentText, parentId } = validation.data;
    const db = getDB(locals.runtime.env);

    const result = await db
      .insert(newsComments)
      .values({
        newsId,
        userId: user.uid,
        commentText,
        parentId,
      })
      .returning({ id: newsComments.id, createdAt: newsComments.createdAt });

    const inserted = result[0];
    if (!inserted) throw new Error('Insert failed');

    return new Response(
      JSON.stringify({
        id: inserted.id,
        createdAt: inserted.createdAt,
        commentText: commentText,
        parentId: parentId,
        userId: user.uid,
        username:
          user.username ||
          user.displayName ||
          user.email?.split('@')[0] ||
          'Usuario',
        avatarUrl: user.photoURL,
      }),
      { status: 201 }
    );
  } catch (e) {
    console.error('Error adding news comment:', e);
    return new Response('Error adding comment', { status: 500 });
  }
};
