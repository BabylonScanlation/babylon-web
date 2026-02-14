import type { APIRoute } from 'astro';
import { logError } from '@lib/logError';
import { getDB } from '@lib/db';
import { chapterViews } from '@/db/schema';
import { sql } from 'drizzle-orm';
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

    // ORION: LIGHTSPEED VIEWS (Filtro KV)
    // Evitamos tocar D1 si la vista ya fue contada en las últimas 24h
    const kv = locals.runtime.env.KV_VIEWS;
    const viewKey = `cv:${chapterId}:${ipAddress}`;
    
    if (kv) {
        const alreadyViewed = await kv.get(viewKey);
        if (alreadyViewed) return new Response('OK'); // Ya contado, salimos rápido
    }

    const runBackgroundUpdate = async () => {
      try {
        const drizzleDb = getDB(locals.runtime.env);
        
        // 1. REGISTRO ÚNICO (Deduplicación por IP en DB)
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
          
        // 2. MARCAR EN KV PARA EL SIGUIENTE TICK
        if (kv) {
            await kv.put(viewKey, '1', { expirationTtl: 86400 }); // 24 horas
        }
            
      } catch {
         // Silencioso para métricas
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
