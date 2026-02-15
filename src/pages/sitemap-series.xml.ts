import { getDB } from '../lib/db';
import { series } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, url }) => {
  const siteUrl = url.origin;
  const db = getDB(locals.runtime.env);
  
  const allSeries = await db.select({
    slug: series.slug,
    updatedAt: series.createdAt
  })
  .from(series)
  .where(eq(series.isHidden, false))
  .all();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${allSeries.map(s => `
  <url>
    <loc>${siteUrl}/series/${s.slug}</loc>
    <lastmod>${s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=0, must-revalidate'
    }
  });
};
