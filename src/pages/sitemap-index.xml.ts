import { getDB } from '../lib/db';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const siteUrl = 'https://babylon-scanlation.pages.dev';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${siteUrl}/sitemap-series.xml</loc></sitemap>
  <sitemap><loc>${siteUrl}/sitemap-chapters.xml</loc></sitemap>
</sitemapindex>`;

  return new Response(xml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
};
