import { sql } from 'drizzle-orm';
import { anonymousUsers, chapterViews, series } from '../../../../db/schema';
import { createApiRoute } from '../../../../lib/api';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals }) => {
  const db = locals.db;

  try {
    const [totalViewsResult, totalUsersResult, totalSeriesResult] = await Promise.all([
      db.select({ count: sql`COUNT(*)` }).from(chapterViews).get(),
      db.select({ count: sql`COUNT(*)` }).from(anonymousUsers).get(),
      db.select({ count: sql`COUNT(*)` }).from(series).get(),
    ]);

    const stats = {
      totalViews: Number(totalViewsResult?.count || 0),
      totalUsers: Number(totalUsersResult?.count || 0),
      totalSeries: Number(totalSeriesResult?.count || 0),
    };

    return new Response(JSON.stringify(stats), { status: 200 });
  } catch {
    return new Response(
      JSON.stringify({ error: 'No se pudo obtener el resumen de estadísticas.' }),
      { status: 500 }
    );
  }
});
