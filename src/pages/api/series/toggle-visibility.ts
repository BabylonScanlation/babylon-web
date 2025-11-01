import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals.runtime.env);
    const { seriesId, isHidden } = await request.json();

    if (seriesId === undefined || isHidden === undefined) {
      return new Response(JSON.stringify({ message: 'seriesId and isHidden are required' }), { status: 400 });
    }

    await db
      .prepare('UPDATE series SET is_hidden = ? WHERE id = ?')
      .bind(isHidden ? 1 : 0, seriesId)
      .run();

    return new Response(JSON.stringify({ message: 'Visibility updated successfully' }), { status: 200 });
  } catch (error) {
    console.error('Error toggling series visibility:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
  }
};
