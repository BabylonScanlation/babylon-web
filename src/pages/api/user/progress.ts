import { createApiRoute } from '../../../lib/api';
import { chapters, chapterViews, series } from '../../../db/schema';
import { eq, desc, and, gt, sql } from 'drizzle-orm';

export const GET = createApiRoute({ auth: 'user' }, async ({ locals }) => {
  const db = locals.db;
  const userId = locals.user?.uid;

  if (!userId) {
    return new Response(JSON.stringify({ progress: [] }), { status: 200 });
  }

  // 1. Get distinct series the user has viewed, ordered by most recent view
  const recentSeries = await db
    .select({
      seriesId: series.id,
      seriesTitle: series.title,
      seriesSlug: series.slug,
      seriesCover: series.coverImageUrl,
      lastViewedAt: sql`MAX(${chapterViews.viewedAt})`.as('lastViewedAt'),
    })
    .from(chapterViews)
    .innerJoin(chapters, eq(chapterViews.chapterId, chapters.id))
    .innerJoin(series, eq(chapters.seriesId, series.id))
    .where(eq(chapterViews.userId, userId))
    .groupBy(series.id)
    .orderBy(desc(sql`lastViewedAt`))
    .limit(10) // Fetch a few more in case some are completed
    .all();

  const progressList = [];

  for (const s of recentSeries) {
    if (progressList.length >= 6) break;

    // 2. Find the last chapter number viewed for this series
    const lastViewedChapter = await db
      .select({
        chapterNumber: chapters.chapterNumber,
      })
      .from(chapterViews)
      .innerJoin(chapters, eq(chapterViews.chapterId, chapters.id))
      .where(and(eq(chapterViews.userId, userId), eq(chapters.seriesId, s.seriesId)))
      .orderBy(desc(chapters.chapterNumber))
      .limit(1)
      .get();

    if (!lastViewedChapter) continue;

    // 3. Find the NEXT chapter
    const nextChapter = await db
      .select({
        id: chapters.id,
        chapterNumber: chapters.chapterNumber,
        title: chapters.title,
        createdAt: chapters.createdAt,
        urlPortada: chapters.urlPortada,
        views: chapters.views,
      })
      .from(chapters)
      .where(
        and(
          eq(chapters.seriesId, s.seriesId),
          gt(chapters.chapterNumber, lastViewedChapter.chapterNumber)
        )
      )
      .orderBy(chapters.chapterNumber)
      .limit(1)
      .get();

    if (nextChapter) {
      progressList.push({
        series: {
          title: s.seriesTitle,
          slug: s.seriesSlug,
          cover: s.seriesCover,
        },
        nextChapter: {
          number: nextChapter.chapterNumber,
          title: nextChapter.title,
          url: `/series/${s.seriesSlug}/${nextChapter.chapterNumber}`,
          createdAt: nextChapter.createdAt,
          urlPortada: nextChapter.urlPortada,
          views: nextChapter.views || 0
        }
      });
    }
  }

  return new Response(JSON.stringify({ progress: progressList }), { status: 200 });
});
