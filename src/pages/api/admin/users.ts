// src/pages/api/admin/users.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const { user, runtime } = locals;
  const superAdminUid = runtime.env.SUPER_ADMIN_UID;

  if (!user?.isAdmin || user.uid !== superAdminUid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const db = getDB(runtime.env);
    // Fetch only the UIDs
    const { results } = await db.prepare("SELECT user_id FROM UserRoles WHERE role = 'admin'").all<{ user_id: string }>();
    
    // Return UIDs directly, without email
    const adminUsers = results.map(role => ({ uid: role.user_id }));

    return new Response(JSON.stringify(adminUsers), { status: 200 });
  } catch (e) {
    console.error('Error fetching admins:', e);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { user, runtime } = locals;
  const superAdminUid = runtime.env.SUPER_ADMIN_UID;
  const referer = request.headers.get('Referer') || '/admin/users';

  if (!user?.isAdmin || user.uid !== superAdminUid) {
    return redirect(`${referer}?error=No autorizado`);
  }

  const db = getDB(runtime.env);
  const formData = await request.formData();
  const uid = formData.get('uid')?.toString();
  const method = formData.get('_method')?.toString()?.toUpperCase();

  if (method === 'DELETE') {
    // Handle DELETE
    if (!uid) {
      return redirect(`${referer}?error=UID no proporcionado`);
    }
    if (uid === superAdminUid) {
      return redirect(`${referer}?error=No se puede eliminar al Super Administrador`);
    }
    try {
      await db.prepare("DELETE FROM UserRoles WHERE user_id = ? AND role = 'admin'").bind(uid).run();
      return redirect(`${referer}?success=Administrador eliminado con éxito`);
    } catch (e) {
      console.error('Error deleting admin:', e);
      return redirect(`${referer}?error=Error al eliminar administrador`);
    }
  } else {
    // Handle ADD
    if (!uid) {
      return redirect(`${referer}?error=UID no proporcionado`);
    }
    try {
      // The check to verify the user in Firebase is removed to avoid Node.js dependencies.
      await db.prepare("INSERT OR IGNORE INTO UserRoles (user_id, role) VALUES (?, 'admin')").bind(uid).run();
      return redirect(`${referer}?success=Administrador añadido con éxito`);
    } catch (e: any) {
      console.error('Error adding admin:', e);
      return redirect(`${referer}?error=Error al añadir administrador`);
    }
  }
};
