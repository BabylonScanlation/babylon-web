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
  seriesId: number | null;
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
      newsItem.seriesId, // seriesId is already number | null
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
  return results?.[0] || null;
}

export async function getAllNews(
  db: D1Database,
  status?: 'draft' | 'published',
  seriesId?: number | null // Updated to number | null
): Promise<NewsItem[]> {
  let query = 'SELECT * FROM News';
  const params: (string | number | null)[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (seriesId !== undefined) {
    conditions.push('seriesId = ?');
    params.push(seriesId); // Pass directly as number | null
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
    .map((key) => {
      // Handle seriesId specifically if it's being updated
      if (key === 'seriesId') {
        // Ensure that seriesId is treated as number | null for binding
        const value = updates[key as keyof typeof updates];
        if (value === '') return `seriesId = NULL`; // Treat empty string as NULL for integer column
        if (typeof value === 'string') return `seriesId = ${parseInt(value, 10)}`; // Parse string to int
      }
      return `${key} = ?`;
    })
    .join(', ');
  
  // Filter out seriesId from values if handled separately, or adjust if parsing string to int
  const values = Object.entries(updates)
    .filter(([key]) => key !== 'seriesId')
    .map(([, value]) => value);

  // If seriesId is updated, it's handled in the fields string.
  // Otherwise, if it's in values, it should already be number | null.
  
  // This part needs careful handling to avoid duplicating seriesId or missing it if it's null.
  // A more robust way would be to construct values dynamically from fields.
  
  // Let's refine the updateNews construction:
  const updateFields: string[] = [];
  const updateValues: (string | number | boolean | null)[] = [];

  for (const [key, value] of Object.entries(updates)) {
      if (key === 'seriesId') {
          if (value === '' || value === null) {
              updateFields.push('seriesId = NULL');
          } else if (typeof value === 'string') {
              updateFields.push('seriesId = ?');
              updateValues.push(parseInt(value, 10)); // Ensure it's parsed to number
          } else { // Already a number
              updateFields.push('seriesId = ?');
              updateValues.push(value);
          }
      } else {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
      }
  }

  if (updateFields.length === 0) {
    return getNewsById(db, id); // No updates to apply
  }

  await db
    .prepare(`UPDATE News SET ${updateFields.join(', ')}, updatedAt = ? WHERE id = ?`)
    .bind(...updateValues, now, id)
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
