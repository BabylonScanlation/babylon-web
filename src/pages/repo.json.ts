import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = async () => {
  const repo = {
    name: siteConfig.author,
    website: siteConfig.url
  };

  return new Response(JSON.stringify(repo), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
