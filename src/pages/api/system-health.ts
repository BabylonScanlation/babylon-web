import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env;
  const kv = env.KV_VIEWS;
  const CACHE_KEY = 'system_health_r2';

  // 1. Intentar obtener desde KV primero (TTL: 10 minutos)
  if (kv) {
    const cached = await kv.get(CACHE_KEY);
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600',
        },
      });
    }
  }

  const db = getDB(env);

  try {
    // 1. Verificar D1 (Petición rápida)
    const d1Status = await db
      .run(sql`SELECT 1`)
      .then(() => 'online')
      .catch(() => 'error');

    // 2. Calcular Tamaño R2 (Iterando objetos con límite para seguridad)
    let totalSizeBytes = 0;
    const bucket = env.R2_ASSETS;
    const objects = await bucket.list({ limit: 1000 });

    for (const obj of objects.objects) {
      totalSizeBytes += obj.size;
    }

    const Limit10gb = 10 * 1024 * 1024 * 1024;
    const usagePercent = (totalSizeBytes / Limit10gb) * 100;

    let r2Level: 'low' | 'medium' | 'high' = 'low';
    if (usagePercent > 90) r2Level = 'high';
    else if (usagePercent > 70) r2Level = 'medium';

    const result = JSON.stringify({
      systems: {
        d1: d1Status,
        auth: 'online',
        bot: 'online',
        r2: {
          percent: usagePercent.toFixed(1),
          level: r2Level,
        },
      },
    });

    // Guardar en KV si está disponible
    if (kv) {
      await kv.put(CACHE_KEY, result, { expirationTtl: 600 });
    }

    return new Response(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Fallo al obtener telemetría' }), { status: 500 });
  }
};
