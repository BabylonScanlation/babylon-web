// src/pages/api/admin/users.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { getAuth } from 'firebase-admin/auth';
import { app } from '../../../lib/firebase/server'; // Assuming you have a firebase server app initialized

export const GET: APIRoute = async ({ locals }) => {
  const { user, runtime } = locals;
  const superAdminUid = runtime.env.SUPER_ADMIN_UID;

  if (!user?.isAdmin || user.uid !== superAdminUid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const db = getDB(runtime.env);
    const { results } = await db.prepare("SELECT user_id FROM UserRoles WHERE role = 'admin'").all<{ user_id: string }>();
    
    const auth = getAuth(app);
    const adminUsers = await Promise.all(
      results.map(async (role) => {
        try {
          const userRecord = await auth.getUser(role.user_id);
          return {
            uid: userRecord.uid,
            email: userRecord.email || 'N/A',
          };
        } catch (error) {
          console.error(`Error fetching user ${role.user_id}:`, error);
          return {
            uid: role.user_id,
            email: 'Usuario no encontrado en Firebase',
          };
        }
      })
    );

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
  const uidToAdd = formData.get('uid')?.toString();
  const method = formData.get('_method')?.toString()?.toUpperCase();

  if (method === 'DELETE') {
    // Handle DELETE
    const uidToDelete = formData.get('uid')?.toString();
    if (!uidToDelete) {
      return redirect(`${referer}?error=UID no proporcionado`);
    }
    if (uidToDelete === superAdminUid) {
      return redirect(`${referer}?error=No se puede eliminar al Super Administrador`);
    }
    try {
      await db.prepare("DELETE FROM UserRoles WHERE user_id = ? AND role = 'admin'").bind(uidToDelete).run();
      return redirect(`${referer}?success=Administrador eliminado con éxito`);
    } catch (e) {
      console.error('Error deleting admin:', e);
      return redirect(`${referer}?error=Error al eliminar administrador`);
    }
  } else {
    // Handle ADD
    if (!uidToAdd) {
      return redirect(`${referer}?error=UID no proporcionado`);
    }
    try {
      const auth = getAuth(app);
      await auth.getUser(uidToAdd); // Verify user exists in Firebase

      await db.prepare("INSERT OR IGNORE INTO UserRoles (user_id, role) VALUES (?, 'admin')").bind(uidToAdd).run();
      return redirect(`${referer}?success=Administrador añadido con éxito`);
    } catch (e: any) {
      console.error('Error adding admin:', e);
      if (e.code === 'auth/user-not-found') {
        return redirect(`${referer}?error=El UID proporcionado no existe en Firebase`);
      }
      return redirect(`${referer}?error=Error al añadir administrador`);
    }
  }
};
