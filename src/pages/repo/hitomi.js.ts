import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config';

export const GET: APIRoute = async () => {
  const siteUrl = siteConfig.url;

  const extensions = [
    {
      id: 'hitomi-001',
      name: 'Hitomi.la',
      version: '1.0.5', // Ajustado a la versión de tu encabezado
      lang: 'es',
      site: 'https://hitomi.la',
      apiUrl: '',
      iconUrl: 'https://hitomi.la/favicon.ico',
      url: `${siteUrl}/repo/hitomi.js`,
      typeSource: 'single',
      nsfw: true,
      itemType: 0,
      sourceCodeLanguage: 1,
      appMinVerReq: '0.1.0',
    },
  ];

  const formattedExtensions = extensions.map((ext) => ({
    ...ext,
    id: String(ext.id),
  }));

  return new Response(JSON.stringify(formattedExtensions), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
