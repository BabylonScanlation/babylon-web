import { series, chapters, comments, seriesComments, userRoles } from '../../db/schema';
import { eq, asc, desc, sql, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';

/**
 * Orion: Obtiene la lista de UIDs de administradores.
 */
export async function getAdmins(db: DrizzleD1Database<typeof schema>) {
  const results = await db.select({ uid: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, 'admin'))
    .all();
  
  return results;
}

export async function getAdminSeriesWithChapters(
  db: DrizzleD1Database<typeof schema>,
  limit: number = 12,
  offset: number = 0,
  includeComments: boolean = false
) {
  // 1. Obtener total
  const totalResult = await db.select({ count: sql<number>`count(*)` }).from(series).get();
  const total = totalResult?.count || 0;

  // 2. Obtener series
  const seriesResults = await db.select().from(series)
    .orderBy(asc(series.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  if (seriesResults.length === 0) return { series: [], total };

  const seriesIds = seriesResults.map(s => s.id);

  // 3. Obtener capítulos
  const chaptersResults = await db.select().from(chapters)
    .where(inArray(chapters.seriesId, seriesIds))
    .orderBy(desc(chapters.chapterNumber))
    .all();

  const chaptersBySeriesId = new Map();
  chaptersResults.forEach(c => {
    if (!chaptersBySeriesId.has(c.seriesId)) chaptersBySeriesId.set(c.seriesId, []);
    chaptersBySeriesId.get(c.seriesId).push({
      ...c,
      comments: [] 
    });
  });

  // 4. Obtener Comentarios
  if (includeComments) {
    const chapterIds = chaptersResults.map(c => c.id);
    const chapterComments = chapterIds.length > 0 
        ? await db.select().from(comments).where(inArray(comments.chapterId, chapterIds)).orderBy(desc(comments.createdAt)).all()
        : [];
    
    chapterComments.forEach(comm => {
        const ch = chaptersResults.find(c => c.id === comm.chapterId);
        if (ch) {
            const seriesChaps = chaptersBySeriesId.get(ch.seriesId);
            seriesChaps?.find((c: any) => c.id === comm.chapterId)?.comments.push(comm);
        }
    });

    const sComments = await db.select().from(seriesComments).where(inArray(seriesComments.seriesId, seriesIds)).orderBy(desc(seriesComments.createdAt)).all();
    
    return {
        total,
        series: seriesResults.map(s => ({
            ...s,
            chapters: chaptersBySeriesId.get(s.id) || [],
            seriesComments: sComments.filter(sc => sc.seriesId === s.id)
        }))
    };
  }

  return {
    total,
    series: seriesResults.map(s => ({
      ...s,
      chapters: chaptersBySeriesId.get(s.id) || [],
      chapterCount: chaptersBySeriesId.get(s.id)?.length || 0,
      seriesComments: []
    }))
  };
}
