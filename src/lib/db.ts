import { eq, and, isNull, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDB } from './db-client';
import { generateUUID } from './utils';

export { getDB };

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  publishedBy: string;
  status: 'draft' | 'published';
  seriesId: number | null;
  authorName: string | null;
}

export interface NewsImageItem {
  id: string;
  newsId: string;
  r2Key: string;
  altText: string | null;
  displayOrder: number;
}

export async function createNews(
  drizzleDb: ReturnType<typeof getDB>,
  newsData: Omit<NewsItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<NewsItem> {
  const id = generateUUID();
  const now = new Date();
  const newsItem: NewsItem = { ...newsData, id, createdAt: now, updatedAt: now };

  await drizzleDb.insert(schema.news).values(newsItem);
  return newsItem;
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

  return {
    ...result,
    seriesSlug: result.seriesSlug || undefined,
    seriesTitle: result.seriesTitle || undefined,
  } as any;
}

export async function getAllNews(
  drizzleDb: ReturnType<typeof getDB>,
  status?: 'draft' | 'published',
  seriesId?: number | null
): Promise<(NewsItem & { seriesCover?: string | null | undefined; seriesTitle?: string | null | undefined; authorAvatar?: string | null | undefined })[]> {
  const conditions = [];

  if (status) {
    conditions.push(eq(schema.news.status, status));
  }
  if (seriesId !== undefined) {
    conditions.push(seriesId === null ? isNull(schema.news.seriesId) : eq(schema.news.seriesId, seriesId));
  }

  try {
    const results = await drizzleDb.select({
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
      .orderBy(desc(schema.news.createdAt))
      .all();

    return (results || []).map(r => ({
      ...r,
      seriesCover: r.seriesCover || undefined,
      seriesTitle: r.seriesTitle || undefined,
      authorAvatar: r.authorAvatar || undefined,
    }));
  } catch (err: any) {
    console.error('Database Error in getAllNews (with joins):', err.message);
    
    // Fallback: Basic news
    try {
      const basicResults = await drizzleDb.select()
        .from(schema.news)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.news.createdAt))
        .all();
        
      return (basicResults || []).map(n => ({
        ...n,
        seriesCover: undefined,
        seriesTitle: undefined,
        authorAvatar: undefined,
      }));
    } catch (fallbackErr: any) {
      console.error('Critical Database Error in getAllNews (basic fallback):', fallbackErr.message);
      return [];
    }
  }
}

export async function updateNews(
  drizzleDb: ReturnType<typeof getDB>,
  id: string,
  updates: any
): Promise<NewsItem | null> {
  const now = new Date();
  const updateData: {[key: string]: any} = { ...updates, updatedAt: now };

  if (typeof updateData.seriesId === 'string') {
    updateData.seriesId = updateData.seriesId === '' ? null : parseInt(updateData.seriesId, 10);
  }

  await drizzleDb.update(schema.news)
    .set(updateData)
    .where(eq(schema.news.id, id));

  return getNewsById(drizzleDb, id);
}

export async function deleteNews(drizzleDb: ReturnType<typeof getDB>, id: string): Promise<boolean> {
  const result = await drizzleDb.delete(schema.news).where(eq(schema.news.id, id)).run();
  return result.changes > 0;
}

export async function addNewsImage(
  drizzleDb: ReturnType<typeof getDB>,
  image: Omit<NewsImageItem, 'id'>
): Promise<NewsImageItem> {
  const id = generateUUID();
  const newsImageItem: NewsImageItem = { ...image, id };
  await drizzleDb.insert(schema.newsImage).values(newsImageItem);
  return newsImageItem;
}

export async function getNewsImages(
  drizzleDb: ReturnType<typeof getDB>,
  newsId: string
): Promise<NewsImageItem[]> {
  const results = await drizzleDb.select()
    .from(schema.newsImage)
    .where(eq(schema.newsImage.newsId, newsId))
    .orderBy(schema.newsImage.displayOrder)
    .all();
  return results || [];
}

export async function deleteNewsImage(
  drizzleDb: ReturnType<typeof getDB>,
  id: string
): Promise<boolean> {
  const result = await drizzleDb.delete(schema.newsImage).where(eq(schema.newsImage.id, id)).run();
  return result.changes > 0;
}
