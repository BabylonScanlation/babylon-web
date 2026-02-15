import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  
  try {
    const db = getDB(locals.runtime.env);
    
    // Obtenemos Series
    const allSeries = await db.select({ slug: series.slug, updatedAt: series.createdAt }).from(series).where(eq(series.isHidden, false)).all();
    
    // Obtenemos solo los últimos 500 capítulos para máxima velocidad
    const recentChapters = await db.select({ slug: series.slug, chapterNumber: chapters.chapterNumber, createdAt: chapters.createdAt }).from(chapters).innerJoin(series, eq(chapters.seriesId, series.id)).where(and(eq(series.isHidden, false), inArray(chapters.status, ['live', 'app_only']))).orderBy(desc(chapters.createdAt)).limit(500).all();

    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>${allSeries.map(s => `<url><loc>${siteUrl}/series/${s.slug}</loc><lastmod>${s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join('')}${recentChapters.map(c => `<url><loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc><lastmod>${c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`).join('')}</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (e) {
    // Si falla la DB, devolvemos al menos la Home para que no sea un 500
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>`, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' }
    });
  }
};
