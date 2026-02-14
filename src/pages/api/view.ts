// src/pages/api/view.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { seriesViews } from '../../db/schema';
import { sql } from 'drizzle-orm';
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

        // 1. REGISTRO ÚNICO (Deduplicación por IP en DB)
        // El Trigger 'tr_increment_series_views' se encargará de sumar +1 en la tabla Series
        // solo cuando la inserción en SeriesViews sea exitosa.
        await drizzleDb.insert(seriesViews)
          .values({ 
            seriesId: seriesId!, 
            ipAddress, 
            viewedAt: sql`CURRENT_TIMESTAMP` 
          })
          .onConflictDoNothing() // Orion: Cero coste extra si la IP ya existe
          .run();

      } catch {
        // Silencioso para no afectar la UX
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
  } catch {
    return new Response('OK');
  }
};
