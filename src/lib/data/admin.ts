import { and, desc, eq, inArray, or, type SQL, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import {
  chapters,
  comments,
  news,
  newsComments,
  scanlationMembers,
  scanlations,
  series,
  seriesComments,
  userRoles,
  users,
} from '../../db/schema';

export async function getAdmins(db: DrizzleD1Database<typeof schema>) {
  const adminUids = await db
    .select({ uid: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, 'admin'))
    .all();
  return adminUids;
}

interface RawComment {
  id: string | number;
  text: string;
  rawDate: string | number | null;
  targetType: string;
  targetName: string | number | null;
  parentName: string | null;
  seriesSlug: string | number | null;
  chapterId: number | null;
  userEmail: string | null;
  userName: string | null;
  userId: string;
  isDeleted: boolean | null;
}

export async function getAdminCommentsActivity(
  db: DrizzleD1Database<typeof schema>,
  scanlationId?: number
) {
  // 1. Últimos comentarios de Capítulos (Filtrado por Scanlation si aplica)
  const chapQuery = db
    .select({
      id: comments.id,
      text: comments.commentText,
      rawDate: sql<string | number | null>`${comments.createdAt}`,
      targetType: sql<string>`'chapter'`,
      targetName: chapters.chapterNumber,
      parentName: series.title,
      seriesSlug: series.slug,
      chapterId: chapters.id,
      userEmail: users.email,
      userName: users.username,
      userId: comments.userId,
      isDeleted: comments.isDeleted,
    })
    .from(comments)
    .leftJoin(chapters, eq(comments.chapterId, chapters.id))
    .leftJoin(series, eq(chapters.seriesId, series.id))
    .leftJoin(users, eq(comments.userId, users.id));

  if (scanlationId !== undefined) {
    chapQuery.where(eq(series.scanlationId, scanlationId));
  }

  const chapComms = await chapQuery.orderBy(desc(comments.createdAt)).limit(300).all();

  // 2. Últimos comentarios de Series
  const serQuery = db
    .select({
      id: seriesComments.id,
      text: seriesComments.commentText,
      rawDate: sql<string | number | null>`${seriesComments.createdAt}`,
      targetType: sql<string>`'series'`,
      targetName: series.title,
      parentName: sql<string>`'Obra'`,
      seriesSlug: series.slug,
      chapterId: sql<number>`NULL`,
      userEmail: users.email,
      userName: users.username,
      userId: seriesComments.userId,
      isDeleted: seriesComments.isDeleted,
    })
    .from(seriesComments)
    .leftJoin(series, eq(seriesComments.seriesId, series.id))
    .leftJoin(users, eq(seriesComments.userId, users.id));

  if (scanlationId !== undefined) {
    serQuery.where(eq(series.scanlationId, scanlationId));
  }

  const serComms = await serQuery.orderBy(desc(seriesComments.createdAt)).limit(300).all();

  // 3. Últimos comentarios de Noticias (Solo si la noticia está vinculada a una serie del scanlation)
  const newsQuery = db
    .select({
      id: newsComments.id,
      text: newsComments.commentText,
      rawDate: sql<string | number | null>`${newsComments.createdAt}`,
      targetType: sql<string>`'news'`,
      targetName: news.title,
      parentName: sql<string>`'Noticia'`,
      seriesSlug: news.id,
      chapterId: sql<number>`NULL`,
      userEmail: users.email,
      userName: users.username,
      userId: newsComments.userId,
      isDeleted: newsComments.isDeleted,
    })
    .from(newsComments)
    .leftJoin(news, eq(newsComments.newsId, news.id))
    .leftJoin(users, eq(newsComments.userId, users.id));

  if (scanlationId !== undefined) {
    // Solo noticias vinculadas a series del scanlation
    newsQuery.leftJoin(series, eq(news.seriesId, series.id));
    newsQuery.where(eq(series.scanlationId, scanlationId));
  }

  const newsComms = await newsQuery.orderBy(desc(newsComments.createdAt)).limit(300).all();

  const parseSafeDate = (raw: string | number | Date | null): string => {
    if (!raw) return new Date(0).toISOString();
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString();
    let ts = Number(raw);
    if (!isNaN(ts) && ts > 0) {
      if (ts < 10000000000) ts *= 1000;
      return new Date(ts).toISOString();
    }
    const dateStr = String(raw);
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return new Date(0).toISOString();
  };

  return [...chapComms, ...serComms, ...newsComms]
    .map((c: RawComment) => ({
      ...c,
      createdAt: parseSafeDate(c.rawDate),
      // Si no hay datos del usuario (huérfano), mostramos el ID para poder rastrearlo
      userEmail: c.userEmail || 'ID: ' + c.userId,
      userName: c.userName || c.userEmail?.split('@')[0] || 'Usuario Desconocido',
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAdminSeriesWithChapters(
  db: DrizzleD1Database<typeof schema>,
  limit: number = 12,
  offset: number = 0,
  searchQuery?: string,
  scanlationId?: number
) {
  let whereClause: SQL | undefined;

  const filters: SQL[] = [];

  if (searchQuery && searchQuery.trim() !== '') {
    filters.push(
      or(
        sql`${series.title} LIKE ${`%${searchQuery}%`}`,
        sql`${series.alternativeNames} LIKE ${`%${searchQuery}%`}`
      ) as SQL
    );
  }

  if (scanlationId !== undefined) {
    filters.push(eq(series.scanlationId, scanlationId));
  }

  if (filters.length > 0) {
    whereClause = and(...filters);
  }

  // 1. Obtener total
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(series)
    .where(whereClause)
    .get();
  const total = totalResult?.count || 0;

  // 2. Obtener series
  const seriesResults = await db
    .select()
    .from(series)
    .where(whereClause)
    .orderBy(desc(series.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  if (seriesResults.length === 0) return { series: [], total };

  const seriesIds = seriesResults.map((s) => s.id);

  // 3. Obtener capítulos
  const chaptersResults = await db
    .select()
    .from(chapters)
    .where(inArray(chapters.seriesId, seriesIds))
    .orderBy(desc(chapters.chapterNumber))
    .all();

  const chaptersBySeriesId = new Map();
  chaptersResults.forEach((c) => {
    if (!chaptersBySeriesId.has(c.seriesId)) chaptersBySeriesId.set(c.seriesId, []);
    chaptersBySeriesId.get(c.seriesId).push({
      ...c,
      comments: [],
    });
  });

  return {
    total,
    series: seriesResults.map((s) => ({
      ...s,
      chapters: chaptersBySeriesId.get(s.id) || [],
      chapterCount: chaptersBySeriesId.get(s.id)?.length || 0,
      seriesComments: [],
    })),
  };
}

export async function getAllScanlations(db: DrizzleD1Database<typeof schema>) {
  const result = await db
    .select({
      id: scanlations.id,
      name: scanlations.name,
      slug: scanlations.slug,
      isActive: scanlations.isActive,
      createdAt: scanlations.createdAt,
      seriesCount: sql<number>`(SELECT count(*) FROM ${series} WHERE ${series.scanlationId} = ${scanlations.id})`,
      memberCount: sql<number>`(SELECT count(*) FROM ${scanlationMembers} WHERE ${scanlationMembers.scanlationId} = ${scanlations.id})`,
    })
    .from(scanlations)
    .orderBy(desc(scanlations.createdAt))
    .all();

  return result;
}

export async function getScanlationDetails(db: DrizzleD1Database<typeof schema>, id: number) {
  const scan = await db.select().from(scanlations).where(eq(scanlations.id, id)).get();
  if (!scan) return null;

  const members = await db
    .select({
      userId: users.id,
      username: users.username,
      email: users.email,
      role: scanlationMembers.role,
      joinedAt: scanlationMembers.joinedAt,
    })
    .from(scanlationMembers)
    .innerJoin(users, eq(scanlationMembers.userId, users.id))
    .where(eq(scanlationMembers.scanlationId, id))
    .all();

  return {
    ...scan,
    members,
  };
}
