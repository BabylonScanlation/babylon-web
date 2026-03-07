import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async () => {
  const manifest = {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: siteConfig.theme.background,
    theme_color: siteConfig.theme.accent,
    icons: [
      {
        src: siteConfig.assets.favicon,
        sizes: 'any',
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
};
