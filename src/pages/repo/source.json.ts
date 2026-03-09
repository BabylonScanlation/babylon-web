import type { APIRoute } from 'astro';
import { siteConfig } from '../../site.config';

export const GET: APIRoute = async () => {
  const siteUrl = siteConfig.url;

  // Formato NATIVO de Mangayomi para extensiones JavaScript
  const sources = [
    {
      "name": "Hitomi.la",
      "id": "hitomi-la-es-js", // El ID debe coincidir con el del archivo JS
      "baseUrl": "https://hitomi.la",
      "lang": "es",
      "typeSource": "single",
      "iconUrl": "https://ltn.gold-usergeneratedcontent.net/favicon-192x192.png",
      "url": `${siteUrl}/repo/apk/hitomi.js`,
      "nsfw": 1,
      "version": "1.0.1",
      "itemType": 0, // 0 = Manga
      "sourceCodeLanguage": 1, // 1 = JavaScript
      "isFullSource": false,
      "appMinVerReq": "0.1.0"
    }
  ];

  return new Response(JSON.stringify(sources), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
