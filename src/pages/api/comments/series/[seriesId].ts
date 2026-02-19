// src/pages/api/comments/series/[seriesId].ts
import type { APIRoute } from 'astro';
import { desc, eq, inArray } from 'drizzle-orm';
import { seriesComments, seriesCommentVotes, userRoles, users } from '../../../../db/schema';
import { getDB } from '../../../../lib/db';
import { logError } from '../../../../lib/logError';

export const GET: APIRoute = async ({ params, locals }) => {
  const { seriesId } = params;
  if (!seriesId) {
    return new Response(JSON.stringify({ error: 'El ID de la serie es obligatorio.' }), {
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
        id: seriesComments.id,
        userId: seriesComments.userId,
        commentText: seriesComments.commentText,
        parentId: seriesComments.parentId, // Added parentId
        createdAt: seriesComments.createdAt,
        updatedAt: seriesComments.updatedAt,
        isPinned: seriesComments.isPinned,
        username: users.username,
        email: users.email, // Fetch email from users table for fallback
        avatarUrl: users.avatarUrl,
        role: userRoles.role,
      })
      .from(seriesComments)
      .leftJoin(users, eq(seriesComments.userId, users.id))
      .leftJoin(userRoles, eq(seriesComments.userId, userRoles.userId))
      .where(eq(seriesComments.seriesId, parseInt(seriesId)))
      .orderBy(desc(seriesComments.isPinned), desc(seriesComments.createdAt))
      .all();

    // --- ORION: Optimización de Votos (Batch Fetching) ---
    // Obtenemos los IDs de los comentarios cargados
    const commentIds = results.map((c) => c.id);

    // Diccionario de votos
    const voteMap = new Map<number, { likes: number; dislikes: number; userVote: number }>();

    if (commentIds.length > 0) {
      // Traemos todos los votos asociados a estos comentarios
      const votes = await drizzleDb
        .select()
        .from(seriesCommentVotes)
        .where(inArray(seriesCommentVotes.commentId, commentIds))
        .all();

      // Procesamos en memoria (Mucho más rápido que subqueries SQL complejas en SQLite D1)
      const currentUserId = locals.user?.uid;

      votes.forEach((v) => {
        const entry = voteMap.get(v.commentId) || {
          likes: 0,
          dislikes: 0,
          userVote: 0,
        };

        if (v.vote === 1) entry.likes++;
        else if (v.vote === -1) entry.dislikes++;

        if (currentUserId && v.userId === currentUserId) {
          entry.userVote = v.vote;
        }

        voteMap.set(v.commentId, entry);
      });
    }

    const formattedResults = results.map((comment) => {
      const stats = voteMap.get(comment.id) || {
        likes: 0,
        dislikes: 0,
        userVote: 0,
      };
      return {
        id: comment.id,
        userId: comment.userId,
        username: comment.username || comment.email?.split('@')[0] || 'Usuario',
        avatarUrl: comment.avatarUrl,
        commentText: comment.commentText,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        isPinned: !!comment.isPinned,
        isAdminComment: comment.role === 'admin',
        likes: stats.likes,
        dislikes: stats.dislikes,
        userVote: stats.userVote,
      };
    });

    return new Response(JSON.stringify(formattedResults), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Vary: 'Cookie',
      },
    });
  } catch (e: unknown) {
    const seriesIdForLog = seriesId; // seriesId should be in scope from Astro.params
    logError(e, 'Error al obtener comentarios de la serie', {
      seriesId: seriesIdForLog,
    });
    return new Response(
      JSON.stringify({
        error: 'Error al obtener los comentarios de la serie.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
