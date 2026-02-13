// src/pages/api/view.ts
import type { APIRoute } from 'astro';
import { logError } from '../../lib/logError';
import { getDB } from '../../lib/db';
import { series, seriesViews } from '../../db/schema';
import { sql, eq } from 'drizzle-orm';
import { hashIpAddress } from '@/lib/crypto';

interface ViewRequestBody {
  seriesId: number;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  let seriesId: number | undefined;
  try {
    const requestBody = (await request.json()) as ViewRequestBody;
    seriesId = requestBody.seriesId;

    if (!seriesId) {
      return new Response('OK'); // Orion: No devolvemos error para no alertar al front
    }

    // Orion: Respondemos inmediatamente para liberar al usuario
    // El procesamiento pesado (Hash + DB) se delega totalmente al background
    const runBackgroundUpdate = async () => {
      try {
        const ipAddress = await hashIpAddress(clientAddress || '0.0.0.0');
        const drizzleDb = getDB(locals.runtime.env);
        const kv = locals.runtime.env.KV_VIEWS;

        // 1. DEDUPLICACIÓN CON KV (30 min)
        if (kv) {
          const viewKey = `view:series:${seriesId}:${ipAddress}`;
          const hasViewed = await kv.get(viewKey);
          if (hasViewed) return;
          await kv.put(viewKey, '1', { expirationTtl: 1800 }); // 30 min
        }

        // 2. ACTUALIZACIÓN ATÓMICA
        // Incrementamos contador en Series y registramos log en SeriesViews
        await drizzleDb.batch([
          drizzleDb.insert(seriesViews)
            .values({ seriesId: seriesId!, ipAddress, viewedAt: sql`CURRENT_TIMESTAMP` })
            .onConflictDoUpdate({
              target: [seriesViews.seriesId, seriesViews.ipAddress],
              set: { viewedAt: sql`CURRENT_TIMESTAMP` }
            }),
          drizzleDb.update(series)
            .set({ views: sql`views + 1` })
            .where(eq(series.id, seriesId!))
        ]);

      } catch (innerError) {
        // Silencioso
        // console.error(innerError);
      }
    };

    const ctx = locals.runtime.ctx || locals.runtime;
    if (ctx?.waitUntil) {
      ctx.waitUntil(runBackgroundUpdate());
    } else {
      // En local sin waitUntil, usamos un timeout para no bloquear el hilo principal
      setTimeout(runBackgroundUpdate, 0);
    }

    return new Response('OK');
  } catch (e: unknown) {
    return new Response('OK');
  }
};
