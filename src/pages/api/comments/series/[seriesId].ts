// src/pages/api/comments/series/[seriesId].ts
import type { APIRoute } from 'astro';
import { logError } from '../../../../lib/logError';
import { getDB } from '../../../../lib/db';
import { seriesComments } from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ params, locals }) => {
  const { seriesId } = params;
  if (!seriesId) {
    return new Response(JSON.stringify({ error: 'Series ID is required' }), {
      status: 400,
    });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const results = await drizzleDb
      .select({
        id: seriesComments.id,
        userEmail: seriesComments.userEmail,
        commentText: seriesComments.commentText,
        createdAt: seriesComments.createdAt,
      })
      .from(seriesComments)
      .where(eq(seriesComments.seriesId, parseInt(seriesId)))
      .orderBy(desc(seriesComments.createdAt))
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
    const seriesIdForLog = seriesId; // seriesId should be in scope from Astro.params
    logError(e, 'Error al obtener comentarios de la serie', { seriesId: seriesIdForLog });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch series comments' }),
      { status: 500 }
    );
  }
};
