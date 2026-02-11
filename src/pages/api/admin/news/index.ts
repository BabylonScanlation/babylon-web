import { createApiRoute } from '../../../../lib/api';
import { getAllNews, createNews } from '../../../../lib/db';
import * as schema from '../../../../db/schema';
import { eq } from 'drizzle-orm';

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
    const { title, content, status, seriesId } = requestBody;

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios (título o contenido).' }), { status: 400 });
    }

    const drizzleDb = locals.db;
    const dbUser = await drizzleDb
      .select({ 
        username: schema.users.username, 
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl 
      })
      .from(schema.users)
      .where(eq(schema.users.id, locals.user!.uid))
      .get();

    const authorName = dbUser?.username || dbUser?.displayName || 'Admin';

    const newNews = await createNews(locals.db, {
      title,
      content,
      publishedBy: locals.user!.uid, 
      status,
      seriesId: seriesId || null,
      authorName, 
    });

    return new Response(JSON.stringify({ ...newNews, authorAvatar: dbUser?.avatarUrl }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }
);
