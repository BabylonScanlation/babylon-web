import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  const db = getDB(locals.runtime.env);
  
  // Obtenemos los últimos 1000 capítulos para mantener el sitemap manejable y fresco
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

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${recentChapters.map(c => {
    const date = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return `
  <url>
    <loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
    }
  });
};
