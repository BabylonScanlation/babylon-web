// src/pages/api/series/recent-chapters.ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = locals.runtime.env.DB;
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { results: recentChapters } = await db
      .prepare(`
        SELECT
          s.slug, s.title, s.cover_image_url,
          c.chapter_number, c.created_at
        FROM Chapters c
        JOIN Series s ON c.series_id = s.id
        WHERE c.status = 'live' AND c.created_at >= ?
        ORDER BY s.slug, c.created_at DESC
      `)
      .bind(twoDaysAgo)
      .all<any>();

    const seriesMap = new Map();
    for (const chapter of recentChapters) {
      if (!seriesMap.has(chapter.slug)) {
        seriesMap.set(chapter.slug, {
          slug: chapter.slug,
          title: chapter.title,
          cover_image_url: chapter.cover_image_url,
          chapters: [],
        });
      }
      const series = seriesMap.get(chapter.slug);
      if (series.chapters.length < 2) {
        series.chapters.push({ number: chapter.chapter_number, createdAt: chapter.created_at });
      }
    }
    const seriesWithRecentChapters = Array.from(seriesMap.values()).sort((a, b) => {
        const dateA = new Date(a.chapters[0].createdAt).getTime();
        const dateB = new Date(b.chapters[0].createdAt).getTime();
        return dateB - dateA;
    });

    return new Response(JSON.stringify(seriesWithRecentChapters), {
      headers: {
        "content-type": "application/json",
        // ✅ AÑADIDO: Evita que esta respuesta se guarde en caché
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Error al obtener las series con capítulos recientes", { status: 500 });
  }
};