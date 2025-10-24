import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const { chapterId } = params;
  if (!chapterId) {
    return new Response(JSON.stringify({ error: 'Chapter ID is required' }), {
      status: 400,
    });
  }

  try {
    const db = locals.runtime.env.DB;
    const { results } = await db
      .prepare(
        'SELECT id, user_email, comment_text, created_at FROM Comments WHERE chapter_id = ? ORDER BY created_at DESC'
      )
      .bind(chapterId)
      .all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('Error fetching comments:', e);
    return new Response(JSON.stringify({ error: 'Failed to fetch comments' }), {
      status: 500,
    });
  }
};
