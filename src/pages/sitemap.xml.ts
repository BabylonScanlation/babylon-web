import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  const db = getDB(locals.runtime.env);
  const allSeries = await db.select({ slug: series.slug, updatedAt: series.createdAt }).from(series).where(eq(series.isHidden, false)).all();
  const recentChapters = await db.select({ slug: series.slug, chapterNumber: chapters.chapterNumber, createdAt: chapters.createdAt }).from(chapters).innerJoin(series, eq(chapters.seriesId, series.id)).where(and(eq(series.isHidden, false), inArray(chapters.status, ['live', 'app_only']))).orderBy(desc(chapters.createdAt)).limit(100).all();

  // Quitamos el prólogo XML para evitar errores de parseo en Cloudflare
  let xml = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  xml += `<url><loc>${siteUrl}/</loc></url>`;
  allSeries.forEach(s => {
    xml += `<url><loc>${siteUrl}/series/${s.slug}</loc></url>`;
  });
  recentChapters.forEach(c => {
    xml += `<url><loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc></url>`;
  });
  xml += '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};
