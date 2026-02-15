import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  const db = getDB(locals.runtime.env);
  
  const allSeries = await db.select({ slug: series.slug, updatedAt: series.createdAt }).from(series).where(eq(series.isHidden, false)).all();
  const recentChapters = await db.select({ slug: series.slug, chapterNumber: chapters.chapterNumber, createdAt: chapters.createdAt }).from(chapters).innerJoin(series, eq(chapters.seriesId, series.id)).where(and(eq(series.isHidden, false), inArray(chapters.status, ['live', 'app_only']))).orderBy(desc(chapters.createdAt)).limit(500).all();

  // Formato ultra-limpio en una sola línea para evitar errores de parseo
  let xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  xml += `<url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  allSeries.forEach(s => {
    const date = s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `<url><loc>${siteUrl}/series/${s.slug}</loc><lastmod>${date}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  });
  recentChapters.forEach(c => {
    const date = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `<url><loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc><lastmod>${date}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`;
  });
  xml += '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600'
    }
  });
};
