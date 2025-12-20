import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { series, chapters, seriesRatings, seriesReactions } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

interface ChapterOutput {
  chapter_number: number;
  title: string | null;
  created_at: string | null;
  views: number;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug } = params;
  if (!slug) {
    return new Response('Se requiere el slug de la serie', { status: 400 });
  }

  try {
    const drizzleDb = getDB(locals.runtime.env);
    const user = locals.user;

    const seriesData = await drizzleDb.select({
      id: series.id,
      title: series.title,
      slug: series.slug,
      description: series.description,
      coverImageUrl: series.coverImageUrl,
      telegramTopicId: series.telegramTopicId,
      createdAt: series.createdAt,
      views: series.views, // Explicitly included views
      status: series.status,
      type: series.type,
      genres: series.genres,
      author: series.author,
      artist: series.artist,
      publishedBy: series.publishedBy,
      demographic: series.demographic,
      alternativeNames: series.alternativeNames,
      serializedBy: series.serializedBy,
      isHidden: series.isHidden,
    })
      .from(series)
      .where(and(eq(series.slug, slug), eq(series.isHidden, false)))
      .get(); // Removed explicit cast as typeof series.$inferSelect

    if (!seriesData) {
      return new Response('Serie no encontrada', { status: 404 });
    }

    const [
      chaptersResult,
      ratingsResult,
      reactionsResult,
      userRatingResult,
      userReactionResult,
    ] = await Promise.all([
      drizzleDb.select({
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        createdAt: chapters.createdAt,
        views: sql<number>`CAST(IFNULL((SELECT COUNT(*) FROM ChapterViews WHERE chapter_id = ${chapters.id}), 0) AS INTEGER)`.as('views'), // Using SQL to count views
      })
      .from(chapters)
      .where(and(eq(chapters.seriesId, seriesData.id), eq(chapters.status, 'live')))
      .orderBy(desc(chapters.chapterNumber))
      .all(),

      drizzleDb.select({
        rating: seriesRatings.rating,
        count: sql<number>`COUNT(${seriesRatings.rating})`.as('count'),
      })
      .from(seriesRatings)
      .where(eq(seriesRatings.seriesId, seriesData.id))
      .groupBy(seriesRatings.rating)
      .all(),

      drizzleDb.select({
        reactionEmoji: seriesReactions.reactionEmoji,
        count: sql<number>`COUNT(${seriesReactions.reactionEmoji})`.as('count'),
      })
      .from(seriesReactions)
      .where(eq(seriesReactions.seriesId, seriesData.id))
      .groupBy(seriesReactions.reactionEmoji)
      .all(),
      
      user
        ? drizzleDb.select({ rating: seriesRatings.rating })
            .from(seriesRatings)
            .where(and(eq(seriesRatings.seriesId, seriesData.id), eq(seriesRatings.userId, user.uid)))
            .get()
        : Promise.resolve(null),
      user
        ? drizzleDb.select({ reactionEmoji: seriesReactions.reactionEmoji })
            .from(seriesReactions)
            .where(and(eq(seriesReactions.seriesId, seriesData.id), eq(seriesReactions.userId, user.uid)))
            .get()
        : Promise.resolve(null),
    ]);

    let totalVotes = 0;
    let totalRating = 0;
    ratingsResult.forEach((row: { rating: number; count: number }) => { // Added type
      totalVotes += row.count;
      totalRating += row.rating * row.count;
    });
    const averageRating = totalVotes > 0 ? totalRating / totalVotes : 0;

    const reactionCounts = reactionsResult.reduce(
      (acc: Record<string, number>, row: { reactionEmoji: string; count: number }) => { // Added type
        acc[row.reactionEmoji] = row.count;
        return acc;
      },
      {}
    );

    const responseData = {
      ...seriesData,
      cover_image_url: seriesData.coverImageUrl,
      published_by: seriesData.publishedBy,
      alternative_names: seriesData.alternativeNames,
      serialized_by: seriesData.serializedBy,
      is_hidden: seriesData.isHidden,
      chapters: chaptersResult.map((c): ChapterOutput => ({
        chapter_number: c.chapterNumber,
        title: c.title,
        created_at: c.createdAt,
        views: c.views,
      })),
      stats: {
        averageRating: parseFloat(averageRating.toFixed(2)),
        totalVotes,
        reactionCounts,
        userVote: userRatingResult?.rating || null,
        userReaction: userReactionResult?.reactionEmoji || null,
      },
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        'content-type': 'application/json',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    const slugForLog = slug;
    logError(error, 'Error al obtener los detalles de la serie', { slug: slugForLog });
    return new Response('Error al obtener los detalles de la serie', {
      status: 500,
    });
  }
};
