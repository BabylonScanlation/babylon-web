import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config';

export const GET: APIRoute = async () => {
  const repoMeta = {
    meta: {
      name: siteConfig.name,
      website: siteConfig.url,
      signingKeyFingerprint: "",
    }
  };

  return new Response(JSON.stringify(repoMeta), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
