import { createApiRoute } from '../../../../lib/api';
import { chapterViews, chapters, series } from '../../../../db/schema';
import { sql, desc, eq } from 'drizzle-orm';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, request }) => {
  const db = locals.db;
  const url = new URL(request.url);
  const range = url.searchParams.get('range'); // Optional, if not provided it's all time

  try {
    let query = db.select({
      id: series.id,
      title: series.title,
      type: series.type,
      genres: series.genres,
      demographic: series.demographic,
      viewCount: sql<number>`COUNT(${chapterViews.viewedAt})`.as('viewCount'),
      avgRating: sql<number>`(SELECT AVG(rating) FROM SeriesRatings WHERE series_id = ${series.id})`.as('avgRating'),
      voteCount: sql<number>`(SELECT COUNT(*) FROM SeriesRatings WHERE series_id = ${series.id})`.as('voteCount')
    })
    .from(series)
    .leftJoin(chapters, eq(series.id, chapters.seriesId))
    .leftJoin(chapterViews, eq(chapters.id, chapterViews.chapterId));

    if (range && range !== 'all') {
      const days = parseInt(range, 10);
      query = query.where(sql`${chapterViews.viewedAt} >= datetime('now', '-' || ${days} || ' days')`) as any;
    }

    const topSeries = await query
      .groupBy(series.id)
      .orderBy(desc(sql`viewCount`))
      .limit(10) // Increased to 10 for a better table
      .all();

    return new Response(JSON.stringify(topSeries), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'No se pudieron obtener las series más populares.' }), { status: 500 });
  }
});
