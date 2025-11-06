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
        const imageUrls = images.map(img => `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);
        return { ...newsItem, imageUrls };
      })
    );

    return new Response(JSON.stringify(newsWithImages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching public news:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
