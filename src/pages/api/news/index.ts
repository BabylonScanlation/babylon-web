import type { APIRoute } from 'astro';
import { getDB, getAllNews, getNewsImages, type NewsItem, type NewsImageItem } from '../../../lib/db';
import { logError } from '../../../lib/logError';

export const GET: APIRoute = async ({ locals }) => {
  const drizzleDb = getDB(locals.runtime.env);
  try {
    const publishedNews = await getAllNews(drizzleDb, 'published');

    // For each news item, fetch its associated images
    const newsWithImages = await Promise.all(
      publishedNews.map(async (newsItem: NewsItem) => {
        const images = await getNewsImages(drizzleDb, newsItem.id);
        const imageUrls = images.map((img: NewsImageItem) => { // Explicitly typed img
          if (!locals.runtime.env.R2_PUBLIC_URL_ASSETS) {
            logError('R2_PUBLIC_URL_ASSETS is not defined in environment.', 'Configuración de entorno faltante');
            // Return a placeholder or throw an error depending on desired behavior
            return '/placeholder-image.jpg'; // Example: return a placeholder
          }
          return `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`;
        });
        return { ...newsItem, imageUrls };
      })
    );

    return new Response(JSON.stringify(newsWithImages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(error, 'Error al obtener noticias públicas');
    // Return a more informative error response
    return new Response(JSON.stringify({
        error: 'Error interno del servidor al obtener noticias',
        details: error instanceof Error ? error.message : String(error)
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
