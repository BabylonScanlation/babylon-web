import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { getDB } from './db-client';

export { getDB };

// --- Auth Security Helpers ---

/**
 * Orion: Verifica el rol de administrador directamente contra la DB (Slow-Path).
 * Se debe usar para operaciones críticas/destructivas donde el JWT no es suficiente.
 */
export async function checkAdminDB(
  drizzleDb: ReturnType<typeof getDB>,
  userId: string,
  env: { SUPER_ADMIN_UID?: string }
): Promise<boolean> {
  if (env.SUPER_ADMIN_UID && userId === env.SUPER_ADMIN_UID) return true;

  const result = await drizzleDb
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, userId))
    .get();

  return result?.role === 'admin';
}
