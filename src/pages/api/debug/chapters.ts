import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { chapters } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const db = getDB(env);
    const data = await db
      .select({
        id: chapters.id,
        seriesId: chapters.seriesId,
        chapterNumber: chapters.chapterNumber,
        isNsfw: chapters.isNsfw,
        status: chapters.status,
        createdAt: chapters.createdAt,
      })
      .from(chapters)
      .where(eq(chapters.chapterNumber, 22))
      .all();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    return new Response((err as Error).message, { status: 500 });
  }
};
