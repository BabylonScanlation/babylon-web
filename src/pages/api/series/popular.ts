// src/pages/api/series/popular.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = locals.runtime.env.DB;
    const { results } = await db
      .prepare(
        'SELECT slug, title, cover_image_url, description, views FROM Series WHERE is_hidden = FALSE ORDER BY views DESC LIMIT 5'
      )
      .all();

    return new Response(JSON.stringify(results), {
      headers: {
        'content-type': 'application/json',
        // ✅ AÑADIDO: Evita que esta respuesta se guarde en caché
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response('Error al obtener las series populares', {
      status: 500,
    });
  }
};
