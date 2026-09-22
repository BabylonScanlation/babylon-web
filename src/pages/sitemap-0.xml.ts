import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

const url = siteConfig.url;
const pages = [
  '/',
  '/anime/',
  '/anime/explore/',
  '/comic/explore/',
  '/library/',
  '/members/',
  '/news/',
  '/sitemap-dynamic.xml',
  '/terms/',
];

export const GET: APIRoute = () => {
  const urls = pages.map((p) => `<url><loc>${url}${p === '/' ? '/' : p}</loc></url>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${urls}</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
