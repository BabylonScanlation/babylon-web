// src/lib/db.ts
import type { D1Database } from '@cloudflare/workers-types';

export function getDB(env: { DB: D1Database }): D1Database {
  return env.DB;
}

// --- News and NewsImage Types ---

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  publishedBy: string;
  status: 'draft' | 'published';
  seriesId: string | null;
  authorName: string;
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
  db: D1Database,
  news: Omit<NewsItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<NewsItem> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const newsItem: NewsItem = { ...news, id, createdAt: now, updatedAt: now };
  await db
    .prepare(
      'INSERT INTO News (id, title, content, createdAt, updatedAt, publishedBy, status, seriesId, authorName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      newsItem.id,
      newsItem.title,
      newsItem.content,
      newsItem.createdAt,
      newsItem.updatedAt,
      newsItem.publishedBy,
      newsItem.status,
      newsItem.seriesId || null,
      newsItem.authorName
    )
    .run();
  return newsItem;
}

export async function getNewsById(
  db: D1Database,
  id: string
): Promise<NewsItem | null> {
  const { results } = await db
    .prepare('SELECT * FROM News WHERE id = ?')
    .bind(id)
    .all<NewsItem>();
  return results?.[0] || null; // Use optional chaining and nullish coalescing
}

export async function getAllNews(
  db: D1Database,
  status?: 'draft' | 'published',
  seriesId?: string | null // Added seriesId parameter
): Promise<NewsItem[]> {
  let query = 'SELECT * FROM News';
  const params: (string | number | null)[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (seriesId !== undefined) {
    // Check for undefined to allow null seriesId
    conditions.push('seriesId = ?');
    params.push(seriesId);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY createdAt DESC';
  const { results } = await db
    .prepare(query)
    .bind(...params)
    .all<NewsItem>();
  return results || [];
}

export async function updateNews(
  db: D1Database,
  id: string,
  updates: Partial<Omit<NewsItem, 'id' | 'createdAt'>>
): Promise<NewsItem | null> {
  const now = Date.now();
  const fields = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(', ');
  const values = Object.values(updates);

  if (fields.length === 0) {
    return getNewsById(db, id); // No updates to apply
  }

  await db
    .prepare(`UPDATE News SET ${fields}, updatedAt = ? WHERE id = ?`)
    .bind(...values, now, id)
    .run();
  return getNewsById(db, id);
}

export async function deleteNews(db: D1Database, id: string): Promise<boolean> {
  const { success } = await db
    .prepare('DELETE FROM News WHERE id = ?')
    .bind(id)
    .run();
  return success;
}

// --- NewsImage Database Functions ---

export async function addNewsImage(
  db: D1Database,
  image: Omit<NewsImageItem, 'id'>
): Promise<NewsImageItem> {
  const id = crypto.randomUUID();
  const newsImageItem: NewsImageItem = { ...image, id };
  await db
    .prepare(
      'INSERT INTO NewsImage (id, newsId, r2Key, altText, displayOrder) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(
      newsImageItem.id,
      newsImageItem.newsId,
      newsImageItem.r2Key,
      newsImageItem.altText,
      newsImageItem.displayOrder
    )
    .run();
  return newsImageItem;
}

export async function getNewsImages(
  db: D1Database,
  newsId: string
): Promise<NewsImageItem[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM NewsImage WHERE newsId = ? ORDER BY displayOrder ASC'
    )
    .bind(newsId)
    .all<NewsImageItem>();
  return results || [];
}

export async function deleteNewsImage(
  db: D1Database,
  id: string
): Promise<boolean> {
  const { success } = await db
    .prepare('DELETE FROM NewsImage WHERE id = ?')
    .bind(id)
    .run();
  return success;
}
