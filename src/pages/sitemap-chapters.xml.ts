import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, url }) => {
  const siteUrl = url.origin;
  const db = getDB(locals.runtime.env);
  
  const recentChapters = await db.select({
    slug: series.slug,
    chapterNumber: chapters.chapterNumber,
    createdAt: chapters.createdAt
  })
  .from(chapters)
  .innerJoin(series, eq(chapters.seriesId, series.id))
  .where(and(
    eq(series.isHidden, false),
    inArray(chapters.status, ['live', 'app_only'])
  ))
  .orderBy(desc(chapters.createdAt))
  .limit(1000)
  .all();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${recentChapters.map(c => `
  <url>
    <loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc>
    <lastmod>${c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')}
</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};
