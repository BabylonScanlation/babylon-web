import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const { db, user } = locals;

  if (!user?.isAdmin) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const { identifier } = await request.json();
    if (!identifier || typeof identifier !== 'string') {
      return new Response('Se requiere el UID del usuario.', { status: 400 });
    }

    // Comprobación simple para evitar la búsqueda por email por ahora
    if (identifier.includes('@')) {
      return new Response(
        JSON.stringify({
          error: 'La búsqueda por email no está implementada. Por favor, utiliza el UID del usuario que puedes encontrar en la consola de Firebase.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Asumimos que es un UID
    const uidToAdd = identifier;

    if (!db) {
      return new Response('Database not available', { status: 500 });
    }

    await db
      .prepare("INSERT OR IGNORE INTO UserRoles (user_id, role) VALUES (?, 'admin')")
      .bind(uidToAdd)
      .run();

    return new Response(JSON.stringify({ success: true, uid: uidToAdd }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error al añadir administrador:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};
