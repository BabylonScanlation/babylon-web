import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  // Formato estándar de Tachiyomi/Mihon compatible con Mangayomi y otros clientes
  const extensions = [
    {
      name: 'Hitomi.la',
      pkg: 'com.babylon.hitomi.js',
      version: '1.0.1',
      code: 101,
      lang: 'es',
      nsfw: 1,
      apk: 'hitomi.js',
      sourceCodeLanguage: 1, // Indica que es una extensión JavaScript nativa
      sources: [
        {
          id: 'hitomi-la-es-js',
          name: 'Hitomi.la',
          lang: 'es',
          baseUrl: 'https://hitomi.la',
        }
      ]
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
