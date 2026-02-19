import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { news } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  // Astra/Orion: Sistema de recuperación de DB ultra-robusto
  const runtime = locals.runtime || {};
  const env = runtime.env || (process.env as any);

  try {
    // Intentamos usar la DB ya instanciada por el middleware o crear una nueva
    const drizzleDb = locals.db || getDB(env);

    if (!drizzleDb) {
      throw new Error('No se pudo inicializar la base de datos');
    }

    let latestNews;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        latestNews = await drizzleDb
          .select({
            id: news.id,
            createdAt: news.createdAt,
          })
          .from(news)
          .where(eq(news.status, 'published'))
          .orderBy(desc(news.createdAt))
          .limit(10)
          .all();
        break;
      } catch (dbErr) {
        attempts++;
        if (attempts >= maxAttempts) throw dbErr;
        // Espera incremental
        await new Promise((r) => setTimeout(r, 200 * attempts));
      }
    }

    // Convert Date objects to numeric timestamps safely
    const formattedNews = (latestNews || []).map((n: any) => {
      try {
        let ts = 0;
        if (n.createdAt instanceof Date) {
          ts = n.createdAt.getTime();
        } else if (typeof n.createdAt === 'number') {
          ts = n.createdAt;
        } else if (typeof n.createdAt === 'string') {
          // Orion: Normalizar formato SQLite (YYYY-MM-DD HH:MM:SS) a ISO para navegadores
          const isoDate = n.createdAt.includes('T')
            ? n.createdAt
            : n.createdAt.replace(' ', 'T') + 'Z';
          ts = new Date(isoDate).getTime();
        }
        return { id: n.id, createdAt: isNaN(ts) ? Date.now() : ts };
      } catch {
        return { id: n.id, createdAt: Date.now() };
      }
    });

    return new Response(JSON.stringify(formattedNews), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'cf-edge-cache': 'no-cache',
      },
    });
  } catch (error) {
    // Orion: Fail-safe extremo. Preferimos devolver vacío a un 500.
    console.error(
      '[API_NEWS_CHECK] Fallo crítico (Silenciado):',
      error instanceof Error ? error.message : error
    );
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
