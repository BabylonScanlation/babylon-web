import type { APIRoute } from 'astro';
import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async ({ locals }: any) => {
  const siteUrl = siteConfig.url;
  const db = getDB(locals.runtime.env);
  
  const allSeries = await db.select({ slug: series.slug, updatedAt: series.createdAt }).from(series).where(eq(series.isHidden, false)).all();
  const recentChapters = await db.select({ slug: series.slug, chapterNumber: chapters.chapterNumber, createdAt: chapters.createdAt }).from(chapters).innerJoin(series, eq(chapters.seriesId, series.id)).where(and(eq(series.isHidden, false), inArray(chapters.status, ['live', 'app_only']))).orderBy(desc(chapters.createdAt)).limit(1000).all();

  let xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  allSeries.forEach(s => {
    const date = s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `<url><loc>${siteUrl}/series/${s.slug}</loc><lastmod>${date}</lastmod></url>`;
  });
  recentChapters.forEach(c => {
    const date = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `<url><loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc><lastmod>${date}</lastmod></url>`;
  });
  xml += '</urlset>';

  const body = new TextEncoder().encode(xml);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': body.length.toString(),
      // 'no-transform' es el secreto para que Cloudflare no rompa el Content-Length
      'Cache-Control': 'public, max-age=3600, no-transform',
      'X-Content-Type-Options': 'nosniff'
    }
  });
};
