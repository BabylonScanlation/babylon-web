import type { APIRoute } from 'astro';
import { getDB, getAllNews, getNewsImages } from '../../../../src/lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const db = getDB(locals.runtime.env);
  try {
    const publishedNews = await getAllNews(db, 'published');

    // For each news item, fetch its associated images
    const newsWithImages = await Promise.all(
      publishedNews.map(async (newsItem) => {
        const images = await getNewsImages(db, newsItem.id);
        const imageUrls = images.map(img => {
          if (!locals.runtime.env.R2_PUBLIC_URL_ASSETS) {
            console.error('R2_PUBLIC_URL_ASSETS is not defined in environment.');
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
    console.error('Error fetching public news:', error);
    // Return a more informative error response
    return new Response(JSON.stringify({
        error: 'Error interno del servidor al obtener noticias',
        details: error instanceof Error ? error.message : String(error)
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
