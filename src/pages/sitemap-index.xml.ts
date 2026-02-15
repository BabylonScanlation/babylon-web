import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const siteUrl = url.origin;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${siteUrl}/sitemap-series.xml</loc></sitemap><sitemap><loc>${siteUrl}/sitemap-chapters.xml</loc></sitemap></sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};
