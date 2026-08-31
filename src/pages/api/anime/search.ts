import type { APIRoute } from 'astro';

// Usar variable de entorno si existe, sino un public fallback.
const API_URL = import.meta.env.CONSUMET_API_URL || 'https://consumet-api-clone.vercel.app';
const PROVIDER = 'anime/gogoanime';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const page = url.searchParams.get('page') || '1';

  if (!query) {
    return new Response(JSON.stringify({ error: 'Search query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const fetchUrl = `${API_URL}/${PROVIDER}/${encodeURIComponent(query)}?page=${page}`;
    const response = await fetch(fetchUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BabylonScanlation/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Upstream API responded with ${response.status}`);
    }

    const data = await response.json();

    // Caché Agresiva: El resultado de la búsqueda se cachea por 1 hora en CDN (Cloudflare) y 30 mins en navegador
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Anime Search API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch anime data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
