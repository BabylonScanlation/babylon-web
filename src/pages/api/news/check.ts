import type { APIRoute } from 'astro';
import { desc, eq, sql } from 'drizzle-orm';
import { news } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  // Astra/Orion: Sistema de recuperación de DB ultra-robusto
  const runtime = locals.runtime || {};
  const env = runtime.env || (process.env as unknown as Record<string, string>);

  try {
    // Intentamos usar la DB ya instanciada por el middleware o crear una nueva
    const drizzleDb = locals.db || getDB(env as any);

    if (!drizzleDb) {
      throw new Error('No se pudo inicializar la base de datos');
    }

    interface NewsCheckResult {
      id: number;
      createdAt: Date | string | number | null;
    }

    let latestNews: NewsCheckResult[] = [];
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
          .orderBy(desc(sql`CAST(${news.createdAt} AS INTEGER)`))
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
    const formattedNews = latestNews.map((n) => {
      try {
        let ts = 0;
        const val = n.createdAt;
        if (val instanceof Date) {
          ts = val.getTime();
        } else if (typeof val === 'number') {
          ts = val;
        } else if (typeof val === 'string') {
          // Orion: Normalizar formato SQLite (YYYY-MM-DD HH:MM:SS) a ISO para navegadores
          const isoDate = val.includes('T') ? val : `${val.replace(' ', 'T')}Z`;
          ts = new Date(isoDate).getTime();
        }
        return { id: n.id, createdAt: Number.isNaN(ts) ? Date.now() : ts };
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
