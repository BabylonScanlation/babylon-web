
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDB } from '../../../lib/db';
import { commentVotes, seriesCommentVotes, newsCommentVotes } from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

const VoteSchema = z.object({
  targetType: z.enum(['chapter', 'series', 'news']),
  commentId: z.number().int(),
  vote: z.number().int().min(-1).max(1), // 1, 0 (remove), -1
});

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const result = VoteSchema.safeParse(body);
    
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), { status: 400 });
    }

    const { targetType, commentId, vote } = result.data;
    const db = getDB(locals.runtime.env);
    
    let table;
    
    // Select correct table
    if (targetType === 'series') table = seriesCommentVotes;
    else if (targetType === 'news') table = newsCommentVotes;
    else table = commentVotes;

    if (vote === 0) {
      // Remove vote
      await db.delete(table)
        .where(and(eq(table.commentId, commentId), eq(table.userId, user.uid)))
        .run();
      return new Response(JSON.stringify({ success: true, action: 'removed' }), { status: 200 });
    } else {
      // Upsert vote (Insert or Update if exists)
      await db.insert(table).values({
        userId: user.uid,
        commentId,
        vote
      })
      .onConflictDoUpdate({
        target: [table.userId, table.commentId],
        set: { vote, createdAt: sql`CURRENT_TIMESTAMP` }
      })
      .run();
      return new Response(JSON.stringify({ success: true, action: 'upserted' }), { status: 200 });
    }

  } catch (e) {
    console.error('Vote Error:', e);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};
