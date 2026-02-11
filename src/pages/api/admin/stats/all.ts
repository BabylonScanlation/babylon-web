import { createApiRoute } from '../../../../lib/api';
import { chapterViews, anonymousUsers, series, seriesRatings, comments, seriesReactions, users } from '../../../../db/schema';
import { sql, eq, desc } from 'drizzle-orm';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, url }) => {
  const db = locals.db;
  const kv = locals.runtime.env.KV_VIEWS;
  const range = url.searchParams.get('range') || '7';
  const cacheKey = `admin_stats_all_${range}`;

  // 1. Intentar obtener de caché KV (60 min)
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      return new Response(cached, { 
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' } 
      });
    }
  }

  try {
    const rangeDays = range === 'all' ? 365 * 10 : parseInt(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeDays);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Orion: Si estamos en local sin KV, limitamos drásticamente el rango para no matar D1
    const isLocal = !kv;
    const finalStartDateStr = isLocal && range === 'all' ? '2024-01-01' : startDateStr;

    // --- Consultas Paralelas Optimizadas ---
    const [
      summary,
      dailyViews,
      topSeries,
      engagement,
      categories
    ] = await Promise.all([
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

      // Vistas Diarias (Limitamos el escaneo con el índice de viewedAt)
      db.select({
        date: sql`DATE(viewed_at)`,
        count: sql`COUNT(*)`
      })
      .from(chapterViews)
      .where(sql`viewed_at >= ${finalStartDateStr}`)
      .groupBy(sql`DATE(viewed_at)`)
      .orderBy(desc(sql`DATE(viewed_at)`))
      .limit(31) // Orion: No necesitamos más de un mes de detalle diario en el dashboard principal
      .all(),

      // Top Series (Sin JOINs masivos sobre toda la DB)
      db.select({
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

      // Engagement (Optimizado)
      Promise.all([
        db.select({
          title: series.title,
          interactionCount: sql`COUNT(*)`
        })
        .from(seriesReactions)
        .innerJoin(series, eq(seriesReactions.seriesId, series.id))
        .groupBy(series.id)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(5)
        .all(),

      // Top Commenters (Refactored para evitar escaneo completo)
      db.select({
        email: users.email,
        commentCount: sql<number>`COUNT(*)`
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .groupBy(users.id)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5)
      .all()
      ]).then(([reactions, commenters]) => ({
        topReactedSeries: reactions,
        topCommenters: commenters
      })),

      // Categorías
      Promise.all([
        db.select({ name: series.type, count: sql`COUNT(*)` }).from(series).groupBy(series.type).all(),
        db.select({ name: series.demographic, count: sql`COUNT(*)` }).from(series).groupBy(series.demographic).all()
      ]).then(([types, demos]) => ({
        byType: types,
        byDemographic: demos
      }))
    ]);

    const result = {
      summary,
      dailyViews,
      topSeries,
      engagement,
      categories,
      timestamp: Date.now()
    };

    const responseBody = JSON.stringify(result);

    // Guardar en caché (1 hora)
    if (kv) {
      await kv.put(cacheKey, responseBody, { expirationTtl: 3600 });
    }

    return new Response(responseBody, { status: 200, headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' } });
  } catch (error) {
    console.error('Stats Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
});
