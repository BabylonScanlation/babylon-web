import { getNewsById, getNewsImages } from '../../../../src/lib/data/news';
import { createApiRoute } from '../../../../src/lib/api';

export const GET = createApiRoute({ auth: 'public' }, async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'News ID is required' }), { status: 400 });
  }

  const newsItem = await getNewsById(locals.db, id);

  if (!newsItem || newsItem.status !== 'published') {
    return new Response(JSON.stringify({ error: 'News item not found or not published' }), {
      status: 404,
    });
  }

  const images = await getNewsImages(locals.db, newsItem.id);
  const imageUrls = images.map((img) => `${locals.runtime.env.R2_PUBLIC_URL_ASSETS}/${img.r2Key}`);

  return new Response(JSON.stringify({ ...newsItem, imageUrls }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
