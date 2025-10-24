import type { APIRoute } from 'astro';

interface Series {
  id: number;
  title: string;
  description: string;
  cover_image_url: string;
  slug: string;
  status: string | null;
  type: string | null;
  genres: string | null;
  author: string | null;
  artist: string | null;
  published_by: string | null;
  alternative_names: string | null;
  serialized_by: string | null;
}

interface Chapter {
  id: number;
  series_id: number;
  chapter_number: number;
  title: string;
}

interface Comment {
  id: number;
  chapter_id: number;
  user_email: string;
  comment_text: string;
}

interface SeriesComment {
  id: number;
  series_id: number;
  user_email: string;
  comment_text: string;
}

export const GET: APIRoute = async ({ locals, cookies }) => {
  if (cookies.get('session')?.value !== 'admin-logged-in') {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
    });
  }

  try {
    const db = locals.runtime.env.DB;

    const [
      seriesResults,
      chaptersResults,
      chapterCommentsResults,
      seriesCommentsResults,
    ] = await Promise.all([
      db
        .prepare(
          `
        SELECT 
          id, title, description, cover_image_url, slug, status, type, genres, 
          author, artist, published_by, alternative_names, serialized_by, is_hidden
        FROM Series ORDER BY title ASC
      `
        )
        .all<Series>(),
      db
        .prepare(
          'SELECT id, series_id, chapter_number, title FROM Chapters ORDER BY chapter_number DESC'
        )
        .all<Chapter>(),
      db
        .prepare(
          'SELECT id, chapter_id, user_email, comment_text FROM Comments ORDER BY created_at DESC'
        )
        .all<Comment>()
        .catch(() => ({ results: [] })),
      db
        .prepare(
          'SELECT id, series_id, user_email, comment_text FROM SeriesComments ORDER BY created_at DESC'
        )
        .all<SeriesComment>()
        .catch(() => ({ results: [] })),
    ]);

    const commentsByChapterId = new Map<number, Comment[]>();
    for (const comment of chapterCommentsResults.results) {
      if (!commentsByChapterId.has(comment.chapter_id)) {
        commentsByChapterId.set(comment.chapter_id, []);
      }
      commentsByChapterId.get(comment.chapter_id)?.push(comment);
    }

    const commentsBySeriesId = new Map<number, SeriesComment[]>();
    for (const comment of seriesCommentsResults.results) {
      if (!commentsBySeriesId.has(comment.series_id)) {
        commentsBySeriesId.set(comment.series_id, []);
      }
      commentsBySeriesId.get(comment.series_id)?.push(comment);
    }

    const chaptersBySeriesId = new Map<number, Chapter[]>();
    for (const chapter of chaptersResults.results) {
      if (!chaptersBySeriesId.has(chapter.series_id)) {
        chaptersBySeriesId.set(chapter.series_id, []);
      }
      chaptersBySeriesId.get(chapter.series_id)?.push({
        ...chapter,
        comments: commentsByChapterId.get(chapter.id) || [],
      });
    }

    const finalData = seriesResults.results.map((series: Series) => ({
      ...series,
      chapters: chaptersBySeriesId.get(series.id) || [],
      seriesComments: commentsBySeriesId.get(series.id) || [],
    }));

    return new Response(JSON.stringify(finalData), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error(
      'Error crítico al obtener datos para el panel de admin:',
      error
    );
    return new Response(
      JSON.stringify({
        error: `Error al obtener las series: ${(error instanceof Error ? error.message : String(error))}`,
      }),
      { status: 500 }
    );
  }
};
