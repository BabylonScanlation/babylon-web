import { desc, eq, sql } from 'drizzle-orm';
import { anonymousUsers, series, seriesViews, users } from '../../../../db/schema';
import { createApiRoute } from '../../../../lib/api';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, url }) => {
  const db = locals.db;
  const kv = locals.runtime.env.KV_VIEWS;
  const range = url.searchParams.get('range') || '7';
  const forceRefresh = url.searchParams.get('refresh') === 'true';
  const cacheKey = `admin_stats_all_${range}`;

  if (kv && !forceRefresh) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }
  }

  try {
    const rangeDays = range === 'all' ? 365 * 10 : parseInt(range, 10);
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - rangeDays);
    const timestampLimit = startDate.getTime();

    // Orion: SQL Maestro para normalizar CUALQUIER formato de fecha a milisegundos (ms)
    // Maneja: ISO Strings, YYYY-MM-DD, Segundos y Milisegundos.
    const sqlNormalizeToMs = (col: string) => sql`
      CASE 
        WHEN ${sql.raw(col)} LIKE '20%' THEN strftime('%s', ${sql.raw(col)}) * 1000
        WHEN CAST(${sql.raw(col)} AS INTEGER) < 10000000000 THEN CAST(${sql.raw(col)} AS INTEGER) * 1000
        ELSE CAST(${sql.raw(col)} AS INTEGER)
      END
    `;

    const [summary, dailyViews, topSeries, engagement, categories] = await Promise.all([
      // 1. Resumen
      Promise.all([
        db.select({ count: sql`COUNT(*)` }).from(seriesViews).get(),
        db.select({ count: sql`COUNT(*)` }).from(anonymousUsers).get(),
        db.select({ count: sql`COUNT(*)` }).from(series).get(),
      ]).then(([v, u, s]) => ({
        totalViews: Number(v?.count || 0),
        totalUsers: Number(u?.count || 0),
        totalSeries: Number(s?.count || 0),
      })),

      // 2. Vistas Diarias (Gráfico de Tráfico)
      db
        .select({
          date: sql`DATE(${sqlNormalizeToMs('viewed_at')} / 1000, 'unixepoch')`,
          count: sql`COUNT(*)`,
        })
        .from(seriesViews)
        .where(
          range === 'all' ? undefined : sql`${sqlNormalizeToMs('viewed_at')} >= ${timestampLimit}`
        )
        .groupBy(sql`1`)
        .orderBy(desc(sql`1`))
        .limit(31)
        .all(),

      // 3. Top Series
      db
        .select({
          title: series.title,
          viewCount: series.views,
        })
        .from(series)
        .where(eq(series.isHidden, false))
        .orderBy(desc(series.views))
        .limit(10)
        .all(),

      // 4. Engagement (Interacciones y Comentarios)
      Promise.all([
        db
          .select({
            title: series.title,
            interactionCount: sql<number>`COUNT(*)`,
          })
          .from(
            sql`(
              SELECT series_id, ${sqlNormalizeToMs('created_at')} as ms FROM SeriesReactions
              UNION ALL
              SELECT series_id, ${sqlNormalizeToMs('created_at')} as ms FROM Favorites WHERE type = 'series'
              UNION ALL
              SELECT series_id, ${sqlNormalizeToMs('created_at')} as ms FROM SeriesRatings
            ) as all_interactions`
          )
          .innerJoin(series, eq(sql`all_interactions.series_id`, series.id))
          .where(range === 'all' ? undefined : sql`all_interactions.ms >= ${timestampLimit}`)
          .groupBy(series.id, series.title)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(5)
          .all(),

        // Top Commenters
        db
          .select({
            email: sql<string>`COALESCE(${users.email}, 'anonimo@babylon.com')`,
            username: sql<string>`COALESCE(${users.username}, 'Invitado')`,
            displayName: users.displayName,
            commentCount: sql<number>`COUNT(*)`,
          })
          .from(
            sql`(
              SELECT user_id, ${sqlNormalizeToMs('created_at')} as ms FROM Comments
              UNION ALL
              SELECT user_id, ${sqlNormalizeToMs('created_at')} as ms FROM SeriesComments
              UNION ALL
              SELECT user_id, ${sqlNormalizeToMs('created_at')} as ms FROM NewsComments
            ) as all_comments`
          )
          .leftJoin(users, eq(sql`all_comments.user_id`, users.id))
          .where(range === 'all' ? undefined : sql`all_comments.ms >= ${timestampLimit}`)
          .groupBy(sql`all_comments.user_id`)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(5)
          .all(),
      ]).then(([reactions, commenters]) => ({
        topReactedSeries: reactions,
        topCommenters: commenters,
      })),

      // 5. Categorías
      Promise.all([
        db
          .select({ name: series.type, count: sql`COUNT(*)` })
          .from(series)
          .groupBy(series.type)
          .all(),
        db
          .select({ name: series.demographic, count: sql`COUNT(*)` })
          .from(series)
          .groupBy(series.demographic)
          .all(),
      ]).then(([types, demos]) => ({ byType: types, byDemographic: demos })),
    ]);

    const result = {
      summary,
      dailyViews,
      topSeries,
      engagement,
      categories,
      timestamp: Date.now(),
    };
    const responseBody = JSON.stringify(result);
    if (kv) await kv.put(cacheKey, responseBody, { expirationTtl: 3600 });

    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('Stats Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
});
