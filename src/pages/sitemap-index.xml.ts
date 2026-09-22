import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${siteConfig.url}/sitemap-0.xml</loc></sitemap><sitemap><loc>${siteConfig.url}/sitemap-dynamic.xml</loc></sitemap></sitemapindex>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
