import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const { db, user, runtime } = locals;

  if (!user?.isAdmin) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const { uid } = await request.json();
    if (!uid || typeof uid !== 'string') {
      return new Response('Se requiere el UID del usuario a eliminar.', { status: 400 });
    }

    // Salvaguarda: no permitir que el SUPER_ADMIN_UID sea eliminado de la lista
    // (aunque no debería estar, es una buena práctica)
    const superAdminUid = runtime.env.SUPER_ADMIN_UID;
    if (uid === superAdminUid) {
      return new Response(JSON.stringify({ error: 'No se puede eliminar al Super Administrador.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db
      .prepare('DELETE FROM UserRoles WHERE user_id = ? AND role = ?')
      .bind(uid, 'admin')
      .run();

    return new Response(JSON.stringify({ success: true, uid }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error al eliminar administrador:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};
