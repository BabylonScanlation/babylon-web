import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  
  // Como es prerenderizado en build-time, necesitamos pasar las variables de entorno de otra forma
  // Pero para Cloudflare Pages, usaremos process.env si están disponibles o un fallback seguro
  const db = getDB(process.env as any);
  
  const allSeries = await db.select({ slug: series.slug, updatedAt: series.createdAt }).from(series).where(eq(series.isHidden, false)).all();
  const recentChapters = await db.select({ slug: series.slug, chapterNumber: chapters.chapterNumber, createdAt: chapters.createdAt }).from(chapters).innerJoin(series, eq(chapters.seriesId, series.id)).where(and(eq(series.isHidden, false), inArray(chapters.status, ['live', 'app_only']))).orderBy(desc(chapters.createdAt)).limit(1000).all();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  xml += `<url><loc>${siteUrl}/</loc></url>`;
  
  allSeries.forEach(s => {
    const date = s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `<url><loc>${siteUrl}/series/${s.slug}</loc><lastmod>${date}</lastmod></url>`;
  });
  
  recentChapters.forEach(c => {
    const date = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `<url><loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc><lastmod>${date}</lastmod></url>`;
  });
  
  xml += '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(xml).toString()
    }
  });
};
