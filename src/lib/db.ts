// src/lib/db.ts
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, isNull, desc } from 'drizzle-orm'; // Import and, isNull, desc for conditions and ordering
import * as schema from '../db/schema'; // Import all schema definitions

export function getDB(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema }); // Initialize Drizzle with the schema
}

// --- News and NewsImage Types ---

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

// --- News Database Functions ---

export async function createNews(
  drizzleDb: ReturnType<typeof getDB>, // Accept Drizzle DB instance
  newsData: Omit<NewsItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<NewsItem> {
  const id = crypto.randomUUID();
  const now = new Date();
  const newsItem: NewsItem = { ...newsData, id, createdAt: now, updatedAt: now };

  await drizzleDb.insert(schema.news).values(newsItem);
  return newsItem;
}

export async function getNewsById(
  drizzleDb: ReturnType<typeof getDB>,
  id: string
): Promise<NewsItem | null> {
  const result = await drizzleDb.select()
    .from(schema.news)
    .where(eq(schema.news.id, id))
    .get(); // .get() for a single result

  return result || null;
}

export async function getAllNews(
  drizzleDb: ReturnType<typeof getDB>,
  status?: 'draft' | 'published',
  seriesId?: number | null
): Promise<NewsItem[]> {
  const conditions = [];

  if (status) {
    conditions.push(eq(schema.news.status, status));
  }
  if (seriesId !== undefined) {
    conditions.push(seriesId === null ? isNull(schema.news.seriesId) : eq(schema.news.seriesId, seriesId));
  }

  const results = await drizzleDb.select()
    .from(schema.news)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.news.createdAt))
    .all();

  return results || [];
}

export async function updateNews(
  drizzleDb: ReturnType<typeof getDB>,
  id: string,
  updates: any
): Promise<NewsItem | null> {
  const now = new Date();
  const updateData: {[key: string]: any} = { ...updates, updatedAt: now };

  // Handle seriesId parsing if it comes as a string from a form, Drizzle expects number | null
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
  return result.changes > 0; // D1 returns { changes: number } for delete
}

// --- NewsImage Database Functions ---

export async function addNewsImage(
  drizzleDb: ReturnType<typeof getDB>,
  image: Omit<NewsImageItem, 'id'>
): Promise<NewsImageItem> {
  const id = crypto.randomUUID();
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
