// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const db = locals.runtime.env.DB;
    const query = url.searchParams.get('q');

    // Si no hay consulta, devolvemos un array vacío.
    if (!query || query.trim() === '') {
      return new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Usamos LIKE con '%' para buscar coincidencias parciales.
    const searchTerm = `%${query.trim()}%`;

    const { results } = await db
      .prepare(
        'SELECT slug, title, cover_image_url, description, views FROM Series WHERE title LIKE ? AND is_hidden = FALSE ORDER BY title ASC'
      )
      .bind(searchTerm)
      .all();

    return new Response(JSON.stringify(results), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response('Error al realizar la búsqueda', { status: 500 });
  }
};
