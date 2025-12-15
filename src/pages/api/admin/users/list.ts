import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const { db, user } = locals;

  if (!user?.isAdmin) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    if (!db) {
      return new Response('Database not available', { status: 500 });
    }
    const { results } = await db
      .prepare('SELECT user_id, role FROM UserRoles WHERE role = ?')
      .bind('admin')
      .all();

    // Aquí no tenemos los emails, porque no los guardamos.
    // El frontend tendrá que apañárselas con el UID.
    // Idealmente, podríamos llamar a la API de Admin de Firebase para obtener
    // los detalles de cada usuario, pero el SDK de Admin no está configurado.
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error al listar administradores:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};
