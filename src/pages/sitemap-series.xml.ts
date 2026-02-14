import { getDB } from '../lib/db';
import { series } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  const db = getDB(locals.runtime.env);
  
  const allSeries = await db.select({
    slug: series.slug,
    updatedAt: series.createdAt
  })
  .from(series)
  .where(eq(series.isHidden, false))
  .all();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${allSeries.map(s => `
  <url>
    <loc>${siteUrl}/series/${s.slug}</loc>
    <lastmod>${new Date(s.updatedAt || Date.now()).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
    }
  });
};
