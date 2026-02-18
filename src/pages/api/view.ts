// src/pages/api/view.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { seriesViews } from '../../db/schema';
import { sql } from 'drizzle-orm';
import { hashIpAddress } from '@/lib/crypto';

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    const { seriesId } = (await request.json()) as { seriesId: number };
    if (!seriesId) return new Response('OK');

    const env = locals.runtime.env;
    const kv = env.KV_VIEWS;

    // Orion: Fast-Path - Si no hay KV configurado, caemos a D1 (pero avisamos)
    if (!kv) {
      console.warn('[View API] KV_VIEWS not bound. Falling back to D1 (Expensive).');
    }

    const runViewLogic = async () => {
      try {
        const ipHash = await hashIpAddress(clientAddress || '0.0.0.0');
        const viewKey = `v:s:${seriesId}:${ipHash}`;
        
        // 1. Check KV Gatekeeper (Deduplicación en el Edge)
        // Esto evita CUALQUIER lectura/escritura en D1 si el usuario ya vio la serie hoy.
        if (kv) {
          const alreadyViewed = await kv.get(viewKey);
          if (alreadyViewed) return; // Ya contó hoy, ahorramos D1.
          
          // Marcamos como visto en KV (TTL 24h) antes de ir a D1
          await kv.put(viewKey, '1', { expirationTtl: 86400 });
        }

        // 2. Si llegamos aquí, es una vista nueva (o el TTL expiró)
        const drizzleDb = getDB(env);
        
        // Insertamos en D1. El trigger 'tr_increment_series_views' actualizará el contador real.
        // Usamos onConflictDoNothing por si KV falló o expiró pero el registro en D1 sigue ahí.
        await drizzleDb.insert(seriesViews)
          .values({ 
            seriesId, 
            ipAddress: ipHash, 
            viewedAt: sql`CURRENT_TIMESTAMP` 
          })
          .onConflictDoNothing()
          .run();

      } catch (err) {
        console.error('[View API Error]', err);
      }
    };

    // Usamos waitUntil para no bloquear la respuesta
    if (locals.runtime.ctx?.waitUntil) {
      locals.runtime.ctx.waitUntil(runViewLogic());
    } else {
      setTimeout(runViewLogic, 0);
    }

    return new Response('OK');
  } catch {
    return new Response('OK');
  }
};
