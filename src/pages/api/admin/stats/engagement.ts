import { desc, eq, sql } from 'drizzle-orm';
import { comments, series, seriesReactions, users } from '../../../../db/schema';
import { createApiRoute } from '../../../../lib/api';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals, request }) => {
  const db = locals.db;
  const url = new URL(request.url);
  const range = url.searchParams.get('range');
  const days = range && range !== 'all' ? parseInt(range, 10) : 30;

  try {
    // 1. Top Series by Reactions (Total Emojis)
    const topReactedSeries = await db
      .select({
        title: series.title,
        interactionCount: sql<number>`COUNT(${seriesReactions.reactionEmoji})`,
      })
      .from(seriesReactions)
      .innerJoin(series, eq(seriesReactions.seriesId, series.id))
      .groupBy(series.id)
      .orderBy(desc(sql`COUNT(${seriesReactions.reactionEmoji})`))
      .limit(5)
      .all();

    // 2. Top Commenters
    let commentersQuery = db
      .select({
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        commentCount: sql<number>`COUNT(*)`,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id));

    if (days > 0 && range !== 'all') {
      commentersQuery = commentersQuery.where(
        sql`${comments.createdAt} >= datetime('now', '-' || ${days} || ' days')`
      ) as any;
    }

    const topCommenters = await commentersQuery
      .groupBy(users.email)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5)
      .all();

    const engagementData = {
      topReactedSeries,
      topCommenters,
    };

    return new Response(JSON.stringify(engagementData), { status: 200 });
  } catch (error) {
    console.error('Engagement Stats Error:', error);
    return new Response(
      JSON.stringify({ error: 'No se pudieron obtener las estadísticas de participación.' }),
      { status: 500 }
    );
  }
});
