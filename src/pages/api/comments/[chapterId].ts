import type { APIRoute } from 'astro';
import { logError } from '../../../lib/logError';
import { getDB } from '../../../lib/db';
import { comments, users, commentVotes } from '../../../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  const { chapterId } = params;
  if (!chapterId) {
    return new Response(JSON.stringify({ error: 'El ID del capítulo es obligatorio.' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const results = await drizzleDb
      .select({
        id: comments.id,
        userId: comments.userId,
        parentId: comments.parentId,
        commentText: comments.commentText,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        isPinned: comments.isPinned,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.chapterId, parseInt(chapterId)))
      .orderBy(desc(comments.isPinned), desc(comments.createdAt))
      .all();

    // --- Optimización de Votos ---
    const commentIds = results.map(c => c.id);
    const voteMap = new Map<number, { likes: number, dislikes: number, userVote: number }>();

    if (commentIds.length > 0) {
        const votes = await drizzleDb.select().from(commentVotes)
            .where(inArray(commentVotes.commentId, commentIds))
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

    const formattedResults = results.map(comment => {
      const stats = voteMap.get(comment.id) || { likes: 0, dislikes: 0, userVote: 0 };
      return {
        id: comment.id,
        userId: comment.userId,
        parentId: comment.parentId,
        username: comment.username || comment.email?.split('@')[0] || 'Usuario',
        avatarUrl: comment.avatarUrl,
        commentText: comment.commentText,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        isPinned: !!comment.isPinned,
        likes: stats.likes,
        dislikes: stats.dislikes,
        userVote: stats.userVote
      };
    });

    return new Response(JSON.stringify(formattedResults), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Vary': 'Cookie'
      },
    });
  } catch (e: unknown) {
    const chapterIdForLog = chapterId; // chapterId should be in scope from Astro.params
    logError(e, 'Error al obtener comentarios del capítulo', { chapterId: chapterIdForLog });
    return new Response(JSON.stringify({ error: 'Error al obtener los comentarios.' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
