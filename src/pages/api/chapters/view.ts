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
        const kv = locals.runtime.env.KV_VIEWS;
        
        // 1. DEDUPLICACIÓN VÍA KV (Mucho más rápido que D1 SELECT)
        // Si existe KV, usamos una clave con TTL de 24h para evitar spam.
        if (kv) {
          const viewKey = `view:ch:${chapterId}:${ipAddress}`;
          const hasViewed = await kv.get(viewKey);
          if (hasViewed) {
             return; // Ya visto recientemente
          }
          await kv.put(viewKey, '1', { expirationTtl: 86400 }); // 24h TTL
        }

        // 2. REGISTRO Y ACTUALIZACIÓN ATÓMICA
        // Insertamos el log de auditoría (ChapterViews) y actualizamos el contador (Chapters)
        // Usamos transacciones batch si es posible, o secuencial.
        // Nota: Eliminamos el 'count(*)' costoso. Confiamos en el incremento atómico.
        
        await drizzleDb.insert(chapterViews)
          .values({ 
            chapterId: chapterId!, 
            ipAddress, 
            guestId: guestId || null, 
            userId: userId || null,
            viewedAt: sql`CURRENT_TIMESTAMP` 
          })
          .onConflictDoNothing() // Si la DB rechaza por unicidad (fallback del KV), no pasa nada
          .run();

        await drizzleDb.update(chapters)
          .set({ views: sql`views + 1` })
          .where(eq(chapters.id, chapterId!))
          .run();
            
        // console.log(`[VIEW_FAST] Capítulo ${chapterId} +1 vista.`);
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
