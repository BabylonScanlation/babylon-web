import { desc, eq, sql } from 'drizzle-orm';
import { anonymousUsers, chapterViews, series, users } from '../../../../db/schema';
import { createApiRoute } from '../../../../lib/api';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, url }) => {
  const db = locals.db;
  const kv = locals.runtime.env.KV_VIEWS;
  const range = url.searchParams.get('range') || '7';
  const forceRefresh = url.searchParams.get('refresh') === 'true';
  const cacheKey = `admin_stats_all_${range}`;

  // 1. Intentar obtener de caché KV (60 min)
  if (kv && !forceRefresh) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }
  }

  try {
    const rangeDays = range === 'all' ? 365 * 10 : parseInt(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeDays);
    const startTimestamp = startDate.getTime(); // Usar milisegundos reales

    // Orion: Si estamos en local sin KV, limitamos drásticamente el rango para no matar D1
    const isLocal = !kv;
    const finalStartTimestamp =
      isLocal && range === 'all' ? new Date('2024-01-01').getTime() : startTimestamp;

    // --- Consultas Paralelas Optimizadas ---
    const [summary, dailyViews, topSeries, engagement, categories] = await Promise.all([
      // Resumen (Usamos estimaciones si es posible o consultas simples)
      Promise.all([
        db.select({ count: sql`COUNT(*)` }).from(chapterViews).get(),
        db.select({ count: sql`COUNT(*)` }).from(anonymousUsers).get(),
        db.select({ count: sql`COUNT(*)` }).from(series).get(),
      ]).then(([v, u, s]) => ({
        totalViews: Number(v?.count || 0),
        totalUsers: Number(u?.count || 0),
        totalSeries: Number(s?.count || 0),
      })),

      // Vistas Diarias (Volviendo al formato nativo de fecha de SQLite)
      db
        .select({
          date: sql`DATE(viewed_at)`,
          count: sql`COUNT(*)`,
        })
        .from(chapterViews)
        .where(sql`DATE(viewed_at) >= DATE(${finalStartTimestamp} / 1000, 'unixepoch')`)
        .groupBy(sql`DATE(viewed_at)`)
        .orderBy(desc(sql`DATE(viewed_at)`))
        .limit(31)
        .all(),

      // Top Series (Sin JOINs masivos sobre toda la DB)
      db
        .select({
          title: series.title,
          type: series.type,
          demographic: series.demographic,
          genres: series.genres,
          viewCount: series.views,
        })
        .from(series)
        .where(eq(series.isHidden, false))
        .orderBy(desc(series.views))
        .limit(10)
        .all(),

      // Engagement (Optimizado y Unificado)
      Promise.all([
        db
          .select({
            title: series.title,
            interactionCount: sql<number>`COUNT(*)`,
          })
          .from(
            sql`(
              SELECT series_id, created_at FROM SeriesReactions
              UNION ALL
              SELECT series_id, created_at FROM Favorites WHERE type = 'series'
              UNION ALL
              SELECT series_id, created_at FROM SeriesRatings
            ) as all_interactions`
          )
          .innerJoin(series, eq(sql`all_interactions.series_id`, series.id))
          .where(sql`all_interactions.created_at >= ${finalStartTimestamp}`)
          .groupBy(series.id, series.title)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(5)
          .all(),

        // Top Commenters (Unificado de todas las tablas de comentarios)
        db
          .select({
            email: users.email,
            username: users.username,
            displayName: users.displayName,
            commentCount: sql<number>`COUNT(*)`,
          })
          .from(
            sql`(
              SELECT user_id, created_at FROM Comments
              UNION ALL
              SELECT user_id, created_at FROM SeriesComments
              UNION ALL
              SELECT user_id, created_at FROM NewsComments
            ) as all_comments`
          )
          .leftJoin(users, eq(sql`all_comments.user_id`, users.id))
          .where(sql`all_comments.created_at >= ${finalStartTimestamp}`)
          .groupBy(users.id, users.email, users.username, users.displayName)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(5)
          .all(),
      ]).then(([reactions, commenters]) => ({
        topReactedSeries: reactions,
        topCommenters: commenters,
      })),

      // Categorías
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
      ]).then(([types, demos]) => ({
        byType: types,
        byDemographic: demos,
      })),
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

    // Guardar en caché (1 hora)
    if (kv) {
      await kv.put(cacheKey, responseBody, { expirationTtl: 3600 });
    }

    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (error) {
    console.error('Stats Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
});
