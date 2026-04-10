import type { APIRoute } from 'astro';
import {
  getAllNews,
  getNewsImages,
  type NewsImageItem,
  type NewsWithDetails,
} from '../../../lib/data/news';
import { getDB } from '../../../lib/db';
import { logError } from '../../../lib/logError';

export const GET: APIRoute = async ({ locals }) => {
  const drizzleDb = getDB(locals.runtime.env);
  try {
    const publishedNews = await getAllNews(drizzleDb, 'published');

    // For each news item, fetch its associated images
    const newsWithImages = await Promise.all(
      publishedNews.map(async (newsItem: NewsWithDetails) => {
        const images = await getNewsImages(drizzleDb, newsItem.id);
        const imageUrls = images.map((img: NewsImageItem) => {
          if (!locals.runtime.env.R2_PUBLIC_URL_ASSETS) {
            return '/placeholder-image.jpg';
          }
          return `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`;
        });

        // Debug Log
        if (newsItem.seriesTitle) {
          console.log(
            `[API/News] Noticia vinculada encontrada: ${newsItem.title} -> ${newsItem.seriesTitle}`
          );
        }

        return { ...newsItem, imageUrls };
      })
    );

    return new Response(JSON.stringify(newsWithImages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logError(error, 'Error al obtener noticias públicas');
    // Return a more informative error response
    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor al obtener noticias',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
