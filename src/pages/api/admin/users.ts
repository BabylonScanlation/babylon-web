// src/pages/api/admin/users.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { userRoles } from '../../../db/schema'; // Corrected UserRoles to userRoles
import { eq, and } from 'drizzle-orm';
import { logError } from '../../../lib/logError';


export const GET: APIRoute = async ({ locals }) => {
  const { user, runtime } = locals;
  const superAdminUid = runtime.env.SUPER_ADMIN_UID;

  if (!user?.isAdmin || user.uid !== superAdminUid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const drizzleDb = getDB(runtime.env);
    // Fetch only the UIDs
    const results = await drizzleDb.select({ userId: userRoles.userId })
      .from(userRoles) // Corrected UserRoles to userRoles
      .where(eq(userRoles.role, 'admin'))
      .all();
    
    // Return UIDs directly, without email
    const adminUsers = results.map(role => ({ uid: role.userId })); // Corrected user_id to userId

    return new Response(JSON.stringify(adminUsers), { status: 200 });
  } catch (e: unknown) {
    const userIdForLog = user?.uid;
    logError(e, 'Error al obtener administradores', { userId: userIdForLog });
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

  const drizzleDb = getDB(runtime.env);
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
      await drizzleDb.delete(userRoles) // Corrected UserRoles to userRoles
        .where(and(eq(userRoles.userId, uid), eq(userRoles.role, 'admin')))
        .run();
      return redirect(`${referer}?success=Administrador eliminado con éxito`);
    } catch (e: unknown) {
      const uidForLog = uid;
      const userIdForLog = user?.uid;
      logError(e, 'Error al eliminar administrador', { uid: uidForLog, userId: userIdForLog });
      return redirect(`${referer}?error=Error al eliminar administrador`);
    }
  } else {
    // Handle ADD
    if (!uid) {
      return redirect(`${referer}?error=UID no proporcionado`);
    }
    try {
      // The check to verify the user in Firebase is removed to avoid Node.js dependencies.
      await drizzleDb.insert(userRoles) // Corrected UserRoles to userRoles
        .values({ userId: uid, role: 'admin' })
        .onConflictDoNothing({ target: userRoles.userId });
      return redirect(`${referer}?success=Administrador añadido con éxito`);
    } catch (e: any) {
      const uidForLog = uid;
      const userIdForLog = user?.uid;
      logError(e, 'Error al añadir administrador', { uid: uidForLog, userId: userIdForLog });
      return redirect(`${referer}?error=Error al añadir administrador`);
    }
  }
};
