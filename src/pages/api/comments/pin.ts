import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { comments, newsComments, seriesComments } from '../../../db/schema';
import { getDB } from '../../../lib/db';
import { logError } from '../../../lib/logError';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user || !locals.user.isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const { commentId, targetType, isPinned } = await request.json();

    if (!commentId || !targetType) {
      return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
    }

    const db = getDB(locals.runtime.env);

    let table;
    if (targetType === 'chapter') table = comments;
    else if (targetType === 'series') table = seriesComments;
    else if (targetType === 'news') table = newsComments;
    else return new Response(JSON.stringify({ error: 'Tipo inválido' }), { status: 400 });

    // En SQLite D1, actualizamos el estado de pin
    await db.update(table).set({ isPinned: isPinned }).where(eq(table.id, commentId)).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    logError(error, 'Error al fijar comentario');
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};
