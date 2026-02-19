// src/pages/api/admin/maintenance.ts

import { lt } from 'drizzle-orm';
import { anonymousUsers, chapterViews, seriesViews, sessions } from '../../../db/schema';
import { createApiRoute } from '../../../lib/api';

export const POST = createApiRoute({ auth: 'admin' }, async ({ locals }) => {
  const db = locals.db;
  const now = new Date();

  // Orion: Definimos umbrales de limpieza (objetos Date)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sessionThreshold = Math.floor(now.getTime() / 1000);

  try {
    // 1. Limpiar Vistas de más de 30 días (Ahorro de espacio masivo)
    const cvDeleted = await db
      .delete(chapterViews)
      .where(lt(chapterViews.viewedAt, thirtyDaysAgo))
      .run();
    const svDeleted = await db
      .delete(seriesViews)
      .where(lt(seriesViews.viewedAt, thirtyDaysAgo))
      .run();

    // 2. Limpiar Sesiones expiradas
    const sessionsDeleted = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, sessionThreshold))
      .run();

    // 3. Limpiar Usuarios anónimos inactivos (más de 7 días)
    const anonDeleted = await db
      .delete(anonymousUsers)
      .where(lt(anonymousUsers.updatedAt, sevenDaysAgo))
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        purged: {
          chapterViews: cvDeleted.changes,
          seriesViews: svDeleted.changes,
          sessions: sessionsDeleted.changes,
          anonymousUsers: anonDeleted.changes,
        },
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
