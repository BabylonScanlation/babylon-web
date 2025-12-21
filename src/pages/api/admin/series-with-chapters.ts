import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { series, chapters, comments, seriesComments } from '@/db/schema';
// Añadimos 'inArray' a las importaciones
import { asc, desc, inArray } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user?.isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
    });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);

    // 1. Primero obtenemos SOLO las series
    const seriesResults = await drizzleDb.select({
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
      isAppSeries: series.isAppSeries,
      telegramTopicId: series.telegramTopicId,
      createdAt: series.createdAt,
      views: series.views,
    })
    .from(series)
    .orderBy(asc(series.createdAt))
    .all();

    // Si no hay series, respondemos rápido para ahorrar CPU
    if (!seriesResults.length) {
      return new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Obtenemos los IDs de las series que existen
    const seriesIds = seriesResults.map(s => s.id);

    // 2. Ahora buscamos capítulos y comentarios PERO SOLO de esas series
    const [
      chaptersResults,
      chapterCommentsResults,
      seriesCommentsResults,
    ] = await Promise.all([
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
      .where(inArray(chapters.seriesId, seriesIds)) // <--- ESTO ES LA CLAVE: Filtramos por series existentes
      .orderBy(desc(chapters.chapterNumber))
      .all(),
      
      // Nota: Si tienes miles de comentarios, idealmente también deberías filtrarlos o paginarlos
      drizzleDb.select({
        id: comments.id,
        chapterId: comments.chapterId,
        userEmail: comments.userEmail,
        commentText: comments.commentText,
        createdAt: comments.createdAt,
        userId: comments.userId,
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
        createdAt: seriesComments.createdAt,
        userId: seriesComments.userId,
      })
      .from(seriesComments)
      .where(inArray(seriesComments.seriesId, seriesIds)) // <--- Filtramos también aquí
      .orderBy(desc(seriesComments.createdAt))
      .all()
      .catch(() => []),
    ]);

    // 3. Procesamiento de datos (se mantiene igual, pero ahora procesará menos basura)
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
        is_app_series: !!seriesItem.isAppSeries,
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