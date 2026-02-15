import { getDB } from '../lib/db';
import { series, chapters } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  try {
    const db = getDB(locals.runtime.env);
    const allSeries = await db.select({ slug: series.slug }).from(series).where(eq(series.isHidden, false)).all();
    const recentChapters = await db.select({ slug: series.slug, chapterNumber: chapters.chapterNumber }).from(chapters).innerJoin(series, eq(chapters.seriesId, series.id)).where(and(eq(series.isHidden, false), inArray(chapters.status, ['live', 'app_only']))).orderBy(desc(chapters.createdAt)).limit(1000).all();

    let xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    xml += `<url><loc>${siteUrl}/</loc></url>`;
    allSeries.forEach(s => { xml += `<url><loc>${siteUrl}/series/${s.slug}</loc></url>`; });
    recentChapters.forEach(c => { xml += `<url><loc>${siteUrl}/series/${c.slug}/${c.chapterNumber}</loc></url>`; });
    xml += '</urlset>';

    return new Response(xml, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (e) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
};
