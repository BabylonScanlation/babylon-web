import { desc, eq, sql } from 'drizzle-orm';
import { chapters, chapterViews, series } from '../../../../db/schema';
import { createApiRoute } from '../../../../lib/api';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, request }) => {
  const db = locals.db;
  const url = new URL(request.url);
  const range = url.searchParams.get('range');
  const days = range && range !== 'all' ? parseInt(range, 10) : null;

  try {
    // 1. Stats by Type (Manga, Manhua, etc.)
    let typeQuery = db
      .select({
        name: series.type,
        count: sql<number>`COUNT(*)`.as('views'),
      })
      .from(chapterViews)
      .innerJoin(chapters, eq(chapterViews.chapterId, chapters.id))
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .$dynamic();

    if (days)
      typeQuery = typeQuery.where(
        sql`${chapterViews.viewedAt} >= datetime('now', '-' || ${days} || ' days')`
      );
    const statsByType = await typeQuery.groupBy(series.type).orderBy(desc(sql`views`)).all();

    // 2. Stats by Demographic (Shonen, Seinen, etc.)
    let demoQuery = db
      .select({
        name: series.demographic,
        count: sql<number>`COUNT(*)`.as('views'),
      })
      .from(chapterViews)
      .innerJoin(chapters, eq(chapterViews.chapterId, chapters.id))
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .$dynamic();

    if (days)
      demoQuery = demoQuery.where(
        sql`${chapterViews.viewedAt} >= datetime('now', '-' || ${days} || ' days')`
      );
    const statsByDemo = await demoQuery.groupBy(series.demographic).orderBy(desc(sql`views`)).all();

    // 3. Stats by Genre (Requires more processing because it's a comma-separated string)
    let genreRawQuery = db
      .select({
        genres: series.genres,
      })
      .from(chapterViews)
      .innerJoin(chapters, eq(chapterViews.chapterId, chapters.id))
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .$dynamic();

    if (days)
      genreRawQuery = genreRawQuery.where(
        sql`${chapterViews.viewedAt} >= datetime('now', '-' || ${days} || ' days')`
      );
    const rawGenres = await genreRawQuery.all();

    const genreCounts: Record<string, number> = {};
    rawGenres.forEach((row) => {
      if (!row.genres) return;
      row.genres.split(',').forEach((g) => {
        const name = g.trim();
        if (name && name !== 'N/A') {
          genreCounts[name] = (genreCounts[name] || 0) + 1;
        }
      });
    });

    const statsByGenre = Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return new Response(
      JSON.stringify({
        byType: statsByType,
        byDemographic: statsByDemo,
        byGenre: statsByGenre,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Category Stats Error:', error);
    return new Response(
      JSON.stringify({ error: 'No se pudieron obtener las estadísticas por categoría.' }),
      { status: 500 }
    );
  }
});
