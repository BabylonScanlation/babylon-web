import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import { news, newsImage, series, users } from '../../db/schema';

export async function getNewsList(
  db: DrizzleD1Database<typeof schema>,
  status: 'draft' | 'published' = 'published',
  seriesId?: number | null,
  allowNsfw: boolean = false
) {
  const conditions = [eq(news.status, status)];

  if (seriesId !== undefined) {
    conditions.push(seriesId === null ? isNull(news.seriesId) : eq(news.seriesId, seriesId));
  }

  // Astra: Filtrar noticias de series NSFW si no se permiten
  if (!allowNsfw) {
    // Si la noticia tiene una serie asociada, la serie no debe ser NSFW. 
    // Si no tiene serie asociada, se muestra (noticia general).
    // Nota: Esto requiere que el join esté presente en la consulta principal.
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

    if (!allowNsfw) {
      conditions.push(sql`(Series.is_nsfw IS NULL OR Series.is_nsfw = 0)`);
    }

    const results = await query
      .where(and(...conditions))
      .orderBy(desc(news.createdAt))
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
        seriesCover: r.seriesCover || undefined,
        seriesTitle: r.seriesTitle || undefined,
        authorAvatar: r.authorAvatar || undefined,
        images: images || [],
        imageUrls: images.map((img) => img.r2Key),
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
        .orderBy(desc(news.createdAt))
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

export async function getLatestNewsId(db: DrizzleD1Database<typeof schema>) {
  try {
    const result = await db
      .select({ id: news.id, createdAt: news.createdAt })
      .from(news)
      .where(eq(news.status, 'published'))
      .orderBy(desc(news.createdAt))
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
      imageUrls: images.map((img) => img.r2Key),
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
