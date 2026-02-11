import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import { newsComments, users, newsCommentVotes } from '../../../../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  const { newsId } = params;
  if (!newsId) return new Response('Missing newsId', { status: 400 });

  try {
    const db = getDB(locals.runtime.env);
    const results = await db
      .select({
        id: newsComments.id,
        userId: newsComments.userId,
        commentText: newsComments.commentText,
        parentId: newsComments.parentId,
        createdAt: newsComments.createdAt,
        updatedAt: newsComments.updatedAt,
        isPinned: newsComments.isPinned,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(newsComments)
      .leftJoin(users, eq(newsComments.userId, users.id))
      .where(eq(newsComments.newsId, newsId))
      .orderBy(desc(newsComments.isPinned), desc(newsComments.createdAt))
      .all();

    // --- Optimización de Votos ---
    const commentIds = results.map(c => c.id);
    const voteMap = new Map<number, { likes: number, dislikes: number, userVote: number }>();
    
    if (commentIds.length > 0) {
        const votes = await db.select().from(newsCommentVotes)
            .where(inArray(newsCommentVotes.commentId, commentIds))
            .all();

        const currentUserId = locals.user?.uid;

        votes.forEach(v => {
            const entry = voteMap.get(v.commentId) || { likes: 0, dislikes: 0, userVote: 0 };
            if (v.vote === 1) entry.likes++;
            else if (v.vote === -1) entry.dislikes++;
            if (currentUserId && v.userId === currentUserId) entry.userVote = v.vote;
            voteMap.set(v.commentId, entry);
        });
    }

    const formatted = results.map(c => {
      const stats = voteMap.get(c.id) || { likes: 0, dislikes: 0, userVote: 0 };
      return {
        id: c.id,
        userId: c.userId,
        parentId: c.parentId,
        username: c.displayName || c.username || 'Usuario',
        avatarUrl: c.avatarUrl,
        commentText: c.commentText,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        isPinned: !!c.isPinned,
        likes: stats.likes,
        dislikes: stats.dislikes,
        userVote: stats.userVote
      };
    });

    return new Response(JSON.stringify(formatted), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Vary': 'Cookie'
      },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
};
