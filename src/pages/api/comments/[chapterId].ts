import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { comments } from '../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  const { chapterId } = params;
  if (!chapterId) {
    return new Response(JSON.stringify({ error: 'Chapter ID is required' }), {
      status: 400,
    });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const results = await drizzleDb
      .select({
        id: comments.id,
        userEmail: comments.userEmail,
        commentText: comments.commentText,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.chapterId, parseInt(chapterId)))
      .orderBy(desc(comments.createdAt))
      .all();

    const formattedResults = results.map(comment => ({
      id: comment.id,
      user_email: comment.userEmail,
      comment_text: comment.commentText,
      created_at: comment.createdAt,
    }));

    return new Response(JSON.stringify(formattedResults), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const chapterIdForLog = chapterId; // chapterId should be in scope from Astro.params
    logError(e, 'Error al obtener comentarios del capítulo', { chapterId: chapterIdForLog });
    return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), {
      status: 500,
    });
  }
};
