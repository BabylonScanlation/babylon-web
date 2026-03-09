import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config';

export const GET: APIRoute = async () => {
  const siteUrl = siteConfig.url;

  // Formato de Array plano que Mangayomi espera procesar directamente
  const extensions = [
    {
      id: 'babylon-official-js',
      name: siteConfig.name,
      version: '0.2.1',
      lang: 'es',
      site: siteUrl,
      baseUrl: siteUrl,
      apiUrl: siteUrl,
      iconUrl: `${siteUrl}${siteConfig.assets.favicon}`,
      url: `${siteUrl}/repo/extension.js`,
      typeSource: 'single',
      nsfw: 0,
      itemType: 0, // Manga
      sourceCodeLanguage: 1, // JS
      appMinVerReq: '0.1.0',
    },
    {
      id: 'hitomi-la-es-js',
      name: 'Hitomi.la',
      version: '1.0.1',
      lang: 'es',
      site: 'https://hitomi.la',
      baseUrl: 'https://hitomi.la',
      apiUrl: '',
      iconUrl: 'https://hitomi.la/favicon.ico',
      url: `${siteUrl}/repo/hitomi.js`,
      typeSource: 'single',
      nsfw: 1,
      itemType: 0, // Manga
      sourceCodeLanguage: 1, // JS
      appMinVerReq: '0.1.0',
    }
  ];

  return new Response(JSON.stringify(extensions), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
