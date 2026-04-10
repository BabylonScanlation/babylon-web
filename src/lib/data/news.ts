import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../../db/schema';
import type { getDB } from '../db-client';
import { generateUUID } from '../utils';

// --- Zod Schemas ---

export const NewsSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'El título es obligatorio'),
  content: z.string().min(1, 'El contenido es obligatorio'),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedBy: z.string(),
  status: z.enum(['draft', 'published']).default('draft'),
  seriesId: z.number().nullable(),
  authorName: z.string().nullable(),
});

export const NewsImageSchema = z.object({
  id: z.string(),
  newsId: z.string(),
  r2Key: z.string().min(1),
  altText: z.string().nullable(),
  displayOrder: z.number().int().min(0),
});

// --- Types from Zod ---
export type NewsItem = z.infer<typeof NewsSchema>;
export type NewsImageItem = z.infer<typeof NewsImageSchema>;

// Helper types for creation/update
export type CreateNewsInput = Omit<NewsItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export type CreateNewsImageInput = Omit<NewsImageItem, 'id'>;

export type NewsWithDetails = NewsItem & {
  seriesCover?: string | null;
  seriesTitle?: string | null;
  authorAvatar?: string | null;
  imageUrls?: string[];
};

// --- Database Operations ---

export async function createNews(
  drizzleDb: ReturnType<typeof getDB>,
  newsData: CreateNewsInput
): Promise<NewsItem> {
  const id = newsData.id || generateUUID();
  const now = new Date();

  const newsItem = {
    ...newsData,
    id,
    createdAt: now,
    updatedAt: now,
    seriesId: newsData.seriesId ?? null,
    authorName: newsData.authorName ?? null,
  };

  const validated = NewsSchema.parse(newsItem);
  await drizzleDb.insert(schema.news).values(validated);
  return validated;
}

export async function getNewsById(
  drizzleDb: ReturnType<typeof getDB>,
  id: string
): Promise<(NewsItem & { seriesSlug?: string; seriesTitle?: string }) | null> {
  const result = await drizzleDb
    .select({
      id: schema.news.id,
      title: schema.news.title,
      content: schema.news.content,
      createdAt: schema.news.createdAt,
      updatedAt: schema.news.updatedAt,
      publishedBy: schema.news.publishedBy,
      seriesId: schema.news.seriesId,
      authorName: schema.news.authorName,
      status: schema.news.status,
      seriesSlug: schema.series.slug,
      seriesTitle: schema.series.title,
    })
    .from(schema.news)
    .leftJoin(schema.series, eq(schema.news.seriesId, schema.series.id))
    .where(eq(schema.news.id, id))
    .get();

  if (!result) return null;

  const parsedNews = NewsSchema.safeParse({
    ...result,
    createdAt: result.createdAt ? new Date(result.createdAt) : new Date(),
    updatedAt: result.updatedAt ? new Date(result.updatedAt) : new Date(),
  });

  if (!parsedNews.success) {
    console.error(`[DB Integrity Error] News ID ${id} has invalid data:`, parsedNews.error);
    return null;
  }

  return {
    ...parsedNews.data,
    seriesSlug: result.seriesSlug ?? undefined,
    seriesTitle: result.seriesTitle ?? undefined,
  } as NewsItem & { seriesSlug?: string; seriesTitle?: string };
}

export async function getAllNews(
  drizzleDb: ReturnType<typeof getDB>,
  status?: 'draft' | 'published',
  seriesId?: number | null,
  env?: any
): Promise<NewsWithDetails[]> {
  const conditions = [];

  if (status) {
    conditions.push(eq(schema.news.status, status));
  }
  if (seriesId !== undefined) {
    conditions.push(
      seriesId === null ? isNull(schema.news.seriesId) : eq(schema.news.seriesId, seriesId)
    );
  }

  try {
    const results = await drizzleDb
      .select({
        id: schema.news.id,
        title: schema.news.title,
        content: schema.news.content,
        createdAt: schema.news.createdAt,
        updatedAt: schema.news.updatedAt,
        publishedBy: schema.news.publishedBy,
        seriesId: schema.news.seriesId,
        authorName: schema.news.authorName,
        status: schema.news.status,
        seriesCover: schema.series.coverImageUrl,
        seriesTitle: schema.series.title,
        authorAvatar: schema.users.avatarUrl,
      })
      .from(schema.news)
      .leftJoin(schema.series, eq(schema.news.seriesId, schema.series.id))
      .leftJoin(schema.users, eq(schema.news.publishedBy, schema.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql`CAST(${schema.news.createdAt} AS INTEGER)`))
      .all();

    const validatedItems = await Promise.all(
      results.map(async (r) => {
        const validation = NewsSchema.safeParse({
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        });

        if (!validation.success) {
          console.warn(`[DB Skip] Skipping invalid news item ${r.id}:`, validation.error);
          return null;
        }

        const item: NewsWithDetails = {
          ...validation.data,
          seriesCover: r.seriesCover ?? null,
          seriesTitle: r.seriesTitle ?? null,
          authorAvatar: r.authorAvatar ?? null,
          imageUrls: [],
        };

        if (env) {
          const images = await getNewsImages(drizzleDb, item.id);
          item.imageUrls = images.map((img) => `${env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);
        }

        return item;
      })
    );

    return validatedItems.filter((item): item is NewsWithDetails => item !== null);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Database Error in getAllNews:', message);
    return [];
  }
}

export async function updateNews(
  drizzleDb: ReturnType<typeof getDB>,
  id: string,
  updates: Partial<NewsItem>
): Promise<NewsItem | null> {
  const validatedUpdates = NewsSchema.partial().parse(updates);

  const now = new Date();
  const updateData = {
    ...validatedUpdates,
    updatedAt: now,
  };

  await drizzleDb.update(schema.news).set(updateData).where(eq(schema.news.id, id));

  return getNewsById(drizzleDb, id);
}

export async function deleteNews(
  drizzleDb: ReturnType<typeof getDB>,
  id: string
): Promise<boolean> {
  const result = await drizzleDb.delete(schema.news).where(eq(schema.news.id, id)).run();
  return result.changes > 0;
}

export async function addNewsImage(
  drizzleDb: ReturnType<typeof getDB>,
  image: CreateNewsImageInput
): Promise<NewsImageItem> {
  const id = generateUUID();
  const newsImageItem = { ...image, id };
  const validated = NewsImageSchema.parse(newsImageItem);

  await drizzleDb.insert(schema.newsImage).values(validated);
  return validated;
}

export async function getNewsImages(
  drizzleDb: ReturnType<typeof getDB>,
  newsId: string
): Promise<NewsImageItem[]> {
  const results = await drizzleDb
    .select()
    .from(schema.newsImage)
    .where(eq(schema.newsImage.newsId, newsId))
    .orderBy(schema.newsImage.displayOrder)
    .all();

  return results
    .map((img) => {
      const validation = NewsImageSchema.safeParse(img);
      return validation.success ? validation.data : null;
    })
    .filter((img): img is NewsImageItem => img !== null);
}

export async function deleteNewsImage(
  drizzleDb: ReturnType<typeof getDB>,
  id: string
): Promise<boolean> {
  const result = await drizzleDb.delete(schema.newsImage).where(eq(schema.newsImage.id, id)).run();
  return result.changes > 0;
}

/**
 * Orion: Obtiene el conteo total de noticias publicadas.
 */
export async function getNewsCount(drizzleDb: ReturnType<typeof getDB>): Promise<number> {
  try {
    const result = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(schema.news)
      .where(eq(schema.news.status, 'published'))
      .all();
    return result[0]?.count || 0;
  } catch (error) {
    console.error('Error fetching news count:', error);
    return 0;
  }
}
