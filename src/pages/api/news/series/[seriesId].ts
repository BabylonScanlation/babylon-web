// src/pages/api/news/series/[seriesId].ts
import type { APIRoute } from 'astro';
import { getDB, getAllNews, getNewsImages, type NewsItem, type NewsImageItem } from '../../../../lib/db';
import { logError } from '../../../../lib/logError';

export const GET: APIRoute = async ({ params, locals }) => {
  const { seriesId } = params;
  if (!seriesId) {
    return new Response('Series ID is required', { status: 400 });
  }

  const drizzleDb = getDB(locals.runtime.env);

  try {
    const numericSeriesId = parseInt(seriesId, 10);
    if (isNaN(numericSeriesId)) {
        return new Response('Invalid Series ID', { status: 400 });
    }

    const newsForSeries = await getAllNews(drizzleDb, 'published', numericSeriesId);

    if (newsForSeries.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newsWithImages = await Promise.all(
      newsForSeries.map(async (newsItem: NewsItem) => {
        const images = await getNewsImages(drizzleDb, newsItem.id);
        const imageUrls = images.map((img: NewsImageItem) => `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);
        
        return { 
          ...newsItem, 
          imageUrls,
          // The authorName is now directly available on the newsItem object
        };
      })
    );

    return new Response(JSON.stringify(newsWithImages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const seriesIdForLog = seriesId; // Capture seriesId for log context
    logError(error, 'Error al obtener noticias para la serie', { seriesId: seriesIdForLog });
    return new Response('Internal Server Error', { status: 500 });
  }
};
