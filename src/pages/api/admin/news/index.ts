import { createApiRoute } from '../../../../lib/api';
import { getAllNews, createNews } from '../../../../lib/db';

export const GET = createApiRoute(
  { auth: 'admin' },
  async (context) => {
    const { locals } = context;
    const news = await getAllNews(locals.db);
    return new Response(JSON.stringify(news), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
);

export const POST = createApiRoute(
  { auth: 'admin' },
  async (context) => {
    const { locals, request } = context;
    // Because of `{ auth: 'admin' }`, `locals.user` is guaranteed to be defined and an admin.
    const requestBody = await request.json();
    const { title, content, status, seriesId, authorName } = requestBody;

    if (!title || !content || !status || !authorName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const newNews = await createNews(locals.db, {
      title,
      content,
      publishedBy: locals.user!.uid, // Using non-null assertion as auth check guarantees user exists
      status,
      seriesId: seriesId || null,
      authorName,
    });

    return new Response(JSON.stringify(newNews), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
);
