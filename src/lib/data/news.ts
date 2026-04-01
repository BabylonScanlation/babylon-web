import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import { news, newsImage, series, users } from '../../db/schema';

export async function getNewsList(
  db: DrizzleD1Database<typeof schema>,
  status: 'draft' | 'published' = 'published',
  seriesId?: number | null,
  allowNsfw: boolean = false
) {
  const conditions: any[] = [eq(news.status, status)];

  if (seriesId !== undefined) {
    conditions.push(seriesId === null ? isNull(news.seriesId) : eq(news.seriesId, seriesId));
  }

  // Orion: Modo Estricto para Noticias
  if (allowNsfw) {
    conditions.push(eq(series.isNsfw, true));
  } else {
    conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
  }

  try {
    const query = db
      .select({
        id: news.id,
        title: news.title,
        content: news.content,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        publishedBy: news.publishedBy,
        seriesId: news.seriesId,
        authorName: news.authorName,
        status: news.status,
        seriesCover: series.coverImageUrl,
        seriesTitle: series.title,
        seriesIsNsfw: series.isNsfw,
        authorAvatar: users.avatarUrl,
      })
      .from(news)
      .leftJoin(series, eq(news.seriesId, series.id))
      .leftJoin(users, eq(news.publishedBy, users.id));

    const results = await query
      .where(and(...conditions))
      .orderBy(desc(sql`CAST(${news.createdAt} AS INTEGER)`))
      .all();

    const finalResults = [];
    for (const r of results) {
      const images = await db
        .select()
        .from(newsImage)
        .where(eq(newsImage.newsId, r.id))
        .orderBy(newsImage.displayOrder)
        .all();

      finalResults.push({
        ...r,
        seriesCover: r.seriesCover ? (r.seriesCover.startsWith('http') ? r.seriesCover : `/api/assets/proxy/${r.seriesCover}`) : undefined,
        seriesTitle: r.seriesTitle || undefined,
        authorAvatar: r.authorAvatar || undefined,
        images: images || [],
        imageUrls: images.map((img) => img.r2Key.startsWith('http') ? img.r2Key : `/api/assets/proxy/${img.r2Key}`),
      });
    }

    return finalResults;
  } catch (error) {
    console.error('Error fetching news list with joins:', error);

    // Fallback: Try fetching only news without joins if the complex query fails
    try {
      const basicNews = await db
        .select()
        .from(news)
        .where(and(...conditions))
        .orderBy(desc(sql`CAST(${news.createdAt} AS INTEGER)`))
        .all();

      return basicNews.map((n) => ({
        ...n,
        seriesCover: undefined,
        seriesTitle: undefined,
        authorAvatar: undefined,
        images: [],
        imageUrls: [],
      }));
    } catch (fallbackError) {
      console.error('Critical failure in news fallback:', fallbackError);
      return [];
    }
  }
}

export async function getLatestNewsId(
  db: DrizzleD1Database<typeof schema>,
  allowNsfw: boolean = false
) {
  try {
    const conditions: any[] = [eq(news.status, 'published')];
    if (allowNsfw) {
      conditions.push(eq(series.isNsfw, true));
    } else {
      conditions.push(or(eq(series.isNsfw, false), isNull(series.isNsfw)));
    }

    const result = await db
      .select({ id: news.id, createdAt: news.createdAt })
      .from(news)
      .leftJoin(series, eq(news.seriesId, series.id))
      .where(and(...conditions))
      .orderBy(desc(sql`CAST(${news.createdAt} AS INTEGER)`))
      .limit(1)
      .get();
    return result;
  } catch {
    return null;
  }
}

export async function getNewsDetail(db: DrizzleD1Database<typeof schema>, id: string) {
  try {
    const result = await db
      .select({
        id: news.id,
        title: news.title,
        content: news.content,
        createdAt: news.createdAt,
        updatedAt: news.updatedAt,
        publishedBy: news.publishedBy,
        seriesId: news.seriesId,
        authorName: news.authorName,
        status: news.status,
        seriesSlug: series.slug,
        seriesTitle: series.title,
      })
      .from(news)
      .leftJoin(series, eq(news.seriesId, series.id))
      .where(eq(news.id, id))
      .get();

    if (!result) return null;

    const images = await db
      .select()
      .from(newsImage)
      .where(eq(newsImage.newsId, id))
      .orderBy(newsImage.displayOrder)
      .all();

    return {
      ...result,
      seriesSlug: result.seriesSlug || undefined,
      seriesTitle: result.seriesTitle || undefined,
      images: images || [],
      imageUrls: images.map((img) => img.r2Key.startsWith('http') ? img.r2Key : `/api/assets/proxy/${img.r2Key}`),
    };
  } catch (error) {
    console.error('Error fetching news detail with joins:', error);

    // Fallback: Basic news detail
    try {
      const basicResult = await db.select().from(news).where(eq(news.id, id)).get();

      if (!basicResult) return null;

      return {
        ...basicResult,
        seriesSlug: undefined,
        seriesTitle: undefined,
        images: [],
        imageUrls: [],
      };
    } catch (fallbackError) {
      console.error('Critical failure in news detail fallback:', fallbackError);
      return null;
    }
  }
}
