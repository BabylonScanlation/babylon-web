import type { APIRoute } from 'astro';

const API_URL = import.meta.env.CONSUMET_API_URL || 'https://consumet-api-clone.vercel.app';
const TIMEOUT_MS = 8000; // 8 segundos

// Helper para hacer fetch con timeout
async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BabylonScanlation/1.0',
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Extrae el stream usando un proveedor específico
async function extractStream(provider: string, episodeId: string, server: string = 'vidstreaming') {
  const fetchUrl = `${API_URL}/anime/${provider}/watch/${encodeURIComponent(episodeId)}?server=${server}`;
  const response = await fetchWithTimeout(fetchUrl, TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`${provider} API responded with ${response.status}`);
  }

  const data = await response.json();
  if (!data.sources || data.sources.length === 0) {
    throw new Error(`${provider} returned no sources`);
  }

  return data;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const episodeId = url.searchParams.get('id');

  if (!episodeId) {
    return new Response(JSON.stringify({ error: 'Episode ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Intento principal: Gogoanime (Vidstreaming)
    try {
      console.log(`[Anime Extract] Intentando Gogoanime para: ${episodeId}`);
      const data = await extractStream('gogoanime', episodeId, 'vidstreaming');

      return new Response(JSON.stringify({ provider: 'gogoanime', ...data }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=7200', // Cacheamos el m3u8 por 2 horas
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.warn(
        `[Anime Extract] Gogoanime falló: ${error instanceof Error ? error.message : String(error)}. Intentando fallback a Zoro...`
      );
    }

    // 2. Fallback: Zoro (HiAnime)
    // Nota: El episodeId de Zoro suele ser diferente al de Gogoanime, por lo que esto asume
    // que el frontend envió un ID compatible, o que manejamos un sistema de mapeo.
    // En un escenario real, el "search" y "info" de consumet definen de qué proveedor viene el ID.
    const fallbackData = await extractStream('zoro', episodeId, 'vidstreaming');

    return new Response(JSON.stringify({ provider: 'zoro', ...fallbackData }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=7200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (finalError) {
    console.error('[Anime Extract API] Fallaron todos los proveedores:', finalError);
    return new Response(
      JSON.stringify({ error: 'Failed to extract video stream from all providers' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
