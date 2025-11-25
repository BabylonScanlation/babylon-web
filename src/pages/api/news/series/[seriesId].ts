// src/pages/api/news/series/[seriesId].ts
import type { APIRoute } from 'astro';
import { getDB } from '../../../../lib/db';
import { getAllNews, getNewsImages } from '../../../../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { seriesId } = params;
  if (!seriesId) {
    return new Response('Series ID is required', { status: 400 });
  }

  const db = getDB(locals.runtime.env);

  try {
    const newsForSeries = await getAllNews(db, 'published', seriesId);

    if (newsForSeries.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const newsWithImages = await Promise.all(
      newsForSeries.map(async (newsItem) => {
        const images = await getNewsImages(db, newsItem.id);
        const imageUrls = images.map(img => `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);
        
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
    console.error(`Error fetching news for series ${seriesId}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
