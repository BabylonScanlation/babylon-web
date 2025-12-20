import { createApiRoute } from '../../../lib/api';
import { chapters, series } from '../../../db/schema';
import { isNull } from 'drizzle-orm';

export const GET = createApiRoute(
  { auth: 'admin' },
  async ({ locals }) => {
    const db = locals.db!;
    
    try {
      // 1. Fix Chapters with NULL createdAt
      const chaptersResult = await db.update(chapters)
        .set({ createdAt: new Date().toISOString() })
        .where(isNull(chapters.createdAt))
        .returning({ id: chapters.id })
        .all();

      // 2. Fix Series with NULL createdAt
      const seriesResult = await db.update(series)
        .set({ createdAt: new Date().toISOString() })
        .where(isNull(series.createdAt))
        .returning({ id: series.id })
        .all();

      return new Response(JSON.stringify({
        success: true,
        message: 'Base de datos reparada con éxito.',
        chaptersFixed: chaptersResult.length,
        seriesFixed: seriesResult.length
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error: any) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);
