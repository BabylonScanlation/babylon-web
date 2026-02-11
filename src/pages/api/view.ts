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

        // Orion: Usamos transacciones de una sola línea para máxima velocidad en D1
        await drizzleDb.run(sql`
          INSERT INTO SeriesViews (series_id, ip_address, viewed_at)
          VALUES (${seriesId}, ${ipAddress}, CURRENT_TIMESTAMP)
          ON CONFLICT(series_id, ip_address) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
          WHERE (julianday(CURRENT_TIMESTAMP) - julianday(viewed_at)) * 1440 > 30
        `);
        // Nota: Solo contamos una vista cada 30 min por IP para evitar spam y ahorrar CPU
      } catch (innerError) {
        // Silencioso
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
