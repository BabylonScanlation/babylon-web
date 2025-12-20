import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { series, chapters, comments, seriesComments } from '@/db/schema';

import { asc, desc } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
    });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);

    const [
      seriesResults,
      chaptersResults,
      chapterCommentsResults,
      seriesCommentsResults,
    ] = await Promise.all([
      drizzleDb.select({
        id: series.id,
        title: series.title,
        description: series.description,
        coverImageUrl: series.coverImageUrl,
        slug: series.slug,
        status: series.status,
        type: series.type,
        genres: series.genres,
        author: series.author,
        artist: series.artist,
        publishedBy: series.publishedBy,
        alternativeNames: series.alternativeNames,
        serializedBy: series.serializedBy,
        isHidden: series.isHidden,
        telegramTopicId: series.telegramTopicId,
        createdAt: series.createdAt,
        views: series.views,
      })
      .from(series)
      .orderBy(asc(series.title))
      .all(),

      drizzleDb.select({
        id: chapters.id,
        seriesId: chapters.seriesId,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        telegramFileId: chapters.telegramFileId,
        urlPortada: chapters.urlPortada,
        views: chapters.views,
        createdAt: chapters.createdAt,
        status: chapters.status,
      })
      .from(chapters)
      .orderBy(desc(chapters.chapterNumber))
      .all(),
      
      drizzleDb.select({
        id: comments.id,
        chapterId: comments.chapterId,
        userEmail: comments.userEmail,
        commentText: comments.commentText,
        createdAt: comments.createdAt, // Added
        userId: comments.userId,       // Added
      })
      .from(comments)
      .orderBy(desc(comments.createdAt))
      .all()
      .catch(() => []),

      drizzleDb.select({
        id: seriesComments.id,
        seriesId: seriesComments.seriesId,
        userEmail: seriesComments.userEmail,
        commentText: seriesComments.commentText,
        createdAt: seriesComments.createdAt, // Added
        userId: seriesComments.userId,       // Added
      })
      .from(seriesComments)
      .orderBy(desc(seriesComments.createdAt))
      .all()
      .catch(() => []),
    ]);

    const commentsByChapterId = new Map<number, (typeof comments.$inferSelect)[]>();
    for (const comment of chapterCommentsResults) {
      if (!commentsByChapterId.has(comment.chapterId)) {
        commentsByChapterId.set(comment.chapterId, []);
      }
      commentsByChapterId.get(comment.chapterId)?.push(comment);
    }

    const commentsBySeriesId = new Map<number, (typeof seriesComments.$inferSelect)[]>();
    for (const comment of seriesCommentsResults) {
      if (!commentsBySeriesId.has(comment.seriesId)) {
        commentsBySeriesId.set(comment.seriesId, []);
      }
      commentsBySeriesId.get(comment.seriesId)?.push(comment);
    }

    const chaptersBySeriesId = new Map<number, any[]>();
    for (const chapter of chaptersResults) {
      if (!chaptersBySeriesId.has(chapter.seriesId)) {
        chaptersBySeriesId.set(chapter.seriesId, []);
      }
      chaptersBySeriesId.get(chapter.seriesId)?.push({
        id: chapter.id,
        series_id: chapter.seriesId,
        chapter_number: chapter.chapterNumber,
        title: chapter.title,
        telegram_file_id: chapter.telegramFileId,
        url_portada: chapter.urlPortada,
        views: chapter.views,
        created_at: chapter.createdAt,
        status: chapter.status,
        comments: commentsByChapterId.get(chapter.id) || [],
      });
    }

    const finalData = seriesResults.map((seriesItem) => {
      const trimmedDescription = seriesItem.description ? seriesItem.description.trim() : '';
      return {
        id: seriesItem.id,
        title: seriesItem.title,
        description: trimmedDescription,
        slug: seriesItem.slug,
        cover_image_url: seriesItem.coverImageUrl,
        status: seriesItem.status,
        type: seriesItem.type,
        genres: seriesItem.genres,
        author: seriesItem.author,
        artist: seriesItem.artist,
        published_by: seriesItem.publishedBy,
        alternative_names: seriesItem.alternativeNames,
        serialized_by: seriesItem.serializedBy,
        is_hidden: !!seriesItem.isHidden,
        telegram_topic_id: seriesItem.telegramTopicId,
        created_at: seriesItem.createdAt,
        views: seriesItem.views,
        chapters: chaptersBySeriesId.get(seriesItem.id) || [],
        seriesComments: commentsBySeriesId.get(seriesItem.id) || [],
      };
    });

    return new Response(JSON.stringify(finalData), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: unknown) {
    const userIdForLog = locals.user?.uid;
    logError(error, 'Error crítico al obtener datos para el panel de administración', { userId: userIdForLog });
    return new Response(
      JSON.stringify({
        error: `Error al obtener las series: ${error instanceof Error ? error.message : String(error)}`,
      }),
      { status: 500 }
    );
  }
};
