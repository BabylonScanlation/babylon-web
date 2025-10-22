// src/pages/api/comments/series/[seriesId].ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const { seriesId } = params;
  if (!seriesId) {
    return new Response(JSON.stringify({ error: "Series ID is required" }), { status: 400 });
  }

  try {
    const db = locals.runtime.env.DB;
    const { results } = await db
      .prepare("SELECT id, user_email, comment_text, created_at FROM SeriesComments WHERE series_id = ? ORDER BY created_at DESC")
      .bind(seriesId)
      .all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("Error fetching series comments:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch series comments" }), { status: 500 });
  }
};