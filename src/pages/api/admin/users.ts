import { and, eq } from 'drizzle-orm';
import { userRoles } from '../../../db/schema';
import { createApiRoute } from '../../../lib/api';

export const GET = createApiRoute({ auth: 'admin' }, async ({ locals }) => {
  const { user, runtime, db } = locals;
  const superAdminUid = runtime.env.SUPER_ADMIN_UID;

  // Verificación extra de Super Admin si es necesario (según la lógica original)
  if (user.uid !== superAdminUid) {
    return new Response(
      JSON.stringify({ error: 'Acceso denegado. Se requieren permisos de Super Administrador.' }),
      { status: 403 }
    );
  }

  const results = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, 'admin'))
    .all();

  const adminUsers = results.map((role) => ({ uid: role.userId }));

  return new Response(JSON.stringify(adminUsers), { status: 200 });
});

export const POST = createApiRoute({ auth: 'admin' }, async ({ request, locals }) => {
  const { user, runtime, db } = locals;
  const superAdminUid = runtime.env.SUPER_ADMIN_UID;

  if (user.uid !== superAdminUid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
  }

  const formData = await request.formData();
  const uid = formData.get('uid')?.toString();
  const method = formData.get('_method')?.toString()?.toUpperCase();

  if (method === 'DELETE') {
    if (!uid) return new Response(JSON.stringify({ error: 'UID no proporcionado' }), { status: 400 });
    if (uid === superAdminUid) {
      return new Response(JSON.stringify({ error: 'No se puede eliminar al Super Administrador' }), { status: 400 });
    }
    
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, uid), eq(userRoles.role, 'admin')))
      .run();
      
    return new Response(JSON.stringify({ success: 'Administrador eliminado con éxito' }), { status: 200 });
  } else {
    if (!uid) return new Response(JSON.stringify({ error: 'UID no proporcionado' }), { status: 400 });
    
    await db
      .insert(userRoles)
      .values({ userId: uid, role: 'admin' })
      .onConflictDoNothing({ target: userRoles.userId });
      
    return new Response(JSON.stringify({ success: 'Administrador añadido con éxito' }), { status: 200 });
  }
});
