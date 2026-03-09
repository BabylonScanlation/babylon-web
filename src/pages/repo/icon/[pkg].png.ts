import type { APIRoute } from 'astro';
import { siteConfig } from '../../../site.config';

export const GET: APIRoute = async ({ params }) => {
  const { pkg } = params;

  // Mapeo de paquetes a sus iconos oficiales externos
  const iconMap: Record<string, string> = {
    'com.babylon.hitomi.js':
      'https://ltn.gold-usergeneratedcontent.net/favicon-192x192.png',
  };

  const targetIcon =
    iconMap[pkg || ''] || `${siteConfig.url}${siteConfig.assets.favicon}`;

  return Response.redirect(targetIcon, 307);
};
