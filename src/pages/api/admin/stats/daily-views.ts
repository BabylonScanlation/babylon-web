import { createApiRoute } from '../../../../lib/api';
import { chapterViews } from '../../../../db/schema';
import { sql, desc } from 'drizzle-orm';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, request }) => {
  const db = locals.db;
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '30';
  const days = parseInt(range, 10);

  try {
    // Query views per day for the last N days
    const dailyViews = await db.select({
      date: sql`DATE(${chapterViews.viewedAt})`.as('viewDate'),
      count: sql`COUNT(*)`.as('viewCount')
    })
    .from(chapterViews)
    .where(sql`${chapterViews.viewedAt} >= datetime('now', '-' || ${days} || ' days')`)
    .groupBy(sql`viewDate`)
    .orderBy(desc(sql`viewDate`))
    .all();

    return new Response(JSON.stringify(dailyViews), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'No se pudieron obtener las visitas diarias.' }), { status: 500 });
  }
});
