import { getDB } from '../lib/db';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-series.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-chapters.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new Response(sitemapIndex, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
    }
  });
};
