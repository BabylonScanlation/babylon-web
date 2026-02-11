import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { sql } from 'drizzle-orm';

export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime.env;
  const db = getDB(env);

  try {
    // 1. Verificar D1 (Petición rápida)
    const d1Status = await db.run(sql`SELECT 1`).then(() => 'online').catch(() => 'error');

    // 2. Calcular Tamaño R2 (Iterando objetos con límite para seguridad)
    // En un entorno de producción masivo, esto debería guardarse en una tabla de métricas.
    // Para el volumen actual, podemos listar los objetos.
    let totalSizeBytes = 0;
    const bucket = env.R2_ASSETS;
    const objects = await bucket.list({ limit: 1000 }); // Ajustar si tienes más de 1000 archivos de cache
    
    for (const obj of objects.objects) {
      totalSizeBytes += obj.size;
    }

    const LIMIT_10GB = 10 * 1024 * 1024 * 1024;
    const usagePercent = (totalSizeBytes / LIMIT_10GB) * 100;

    let r2Level: 'low' | 'medium' | 'high' = 'low';
    if (usagePercent > 90) r2Level = 'high';
    else if (usagePercent > 70) r2Level = 'medium';

    return new Response(JSON.stringify({
      systems: {
        d1: d1Status,
        auth: 'online', // Firebase Auth es externo, asumimos online si carga el sitio
        bot: 'online', // El bot es reactivo
        r2: {
          percent: usagePercent.toFixed(1),
          level: r2Level
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Caché de 5 minutos para ahorrar ops
      }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Fallo al obtener telemetría' }), { status: 500 });
  }
};