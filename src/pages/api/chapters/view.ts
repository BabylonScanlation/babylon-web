import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { chapters, chapterViews } from '@/db/schema';
import { eq, sql, and, gt } from 'drizzle-orm';
import { hashIpAddress } from '@/lib/crypto';

interface ViewRequestBody {
  chapterId: number;
}

export const POST: APIRoute = async ({ request, locals, clientAddress, cookies }) => {
  let chapterId: number | undefined;

  try {
    const requestBody = (await request.json()) as ViewRequestBody;
    chapterId = requestBody.chapterId;

    if (!chapterId) {
      return new Response('Se requiere chapterId', { status: 400 });
    }

    const ipAddress = await hashIpAddress(clientAddress || '0.0.0.0');
    const guestId = cookies.get('guestId')?.value || null;
    const userId = locals.user?.uid || null;

    // ORION: Lógica de Vistas Útiles (Sincronización Real con ChapterViews)
    const runBackgroundUpdate = async () => {
      try {
        const drizzleDb = getDB(locals.runtime.env);
        
        // 1. Registrar la visita actual si no existe una reciente (<24h) para esta IP
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const existingView = await drizzleDb.select()
          .from(chapterViews)
          .where(
            and(
              eq(chapterViews.chapterId, chapterId!),
              eq(chapterViews.ipAddress, ipAddress),
              gt(chapterViews.viewedAt, twentyFourHoursAgo)
            )
          )
          .get();

        if (!existingView) {
          await drizzleDb.insert(chapterViews)
            .values({ 
              chapterId: chapterId!, 
              ipAddress, 
              guestId: guestId || null, 
              userId: userId || null,
              viewedAt: sql`CURRENT_TIMESTAMP` 
            })
            .onConflictDoNothing()
            .run();
        }

        // 2. SINCRONIZACIÓN TOTAL: 
        // Recuperamos el total real de registros únicos para este capítulo.
        // Esto garantiza que el contador visual sea 100% fiel a los logs.
        const totalRealViews = await drizzleDb.select({ count: sql<number>`count(*)` })
          .from(chapterViews)
          .where(eq(chapterViews.chapterId, chapterId!))
          .get();

        const count = totalRealViews?.count || 0;

        await drizzleDb.update(chapters)
          .set({ views: count })
          .where(eq(chapters.id, chapterId!))
          .run();
            
        console.log(`[VIEW_SYNC] Capítulo ${chapterId} sincronizado a ${count} vistas reales.`);
      } catch (innerError) {
         logError(innerError, 'Error en sincronización de vistas', { chapterId });
      }
    };

    // En local/dev, esperamos a que termine para asegurar consistencia
    const isDev = locals.runtime.env.DEV || process.env.NODE_ENV === 'development';
    const waitUntil = locals.runtime.ctx?.waitUntil || locals.runtime.waitUntil;
    
    if (waitUntil && !isDev) {
      waitUntil(runBackgroundUpdate());
    } else {
      await runBackgroundUpdate();
    }

    return new Response('OK');
  } catch (e: unknown) {
    const chapterIdForLog = chapterId;
    const ipAddressForLog = clientAddress;
    logError(e, 'Error al iniciar registro de vista (capítulo)', { chapterId: chapterIdForLog, ipAddress: ipAddressForLog });
    // Even if it fails, we don't want to break the client experience for a metric
    return new Response('OK', { status: 200 });
  }
};
