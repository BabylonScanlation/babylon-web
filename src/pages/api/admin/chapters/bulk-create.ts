import type { APIRoute } from 'astro';
import { getDB } from '@lib/db';
import { chapters, series } from '@/db/schema';
import { eq, max } from 'drizzle-orm';
import { logError } from '@lib/logError';

export const POST: APIRoute = async ({ request, locals }) => {
  const { user } = locals;
  if (!user || !user.isAdmin) {
    return new Response(JSON.stringify({ error: 'Acceso denegado. Se requieren permisos de administrador.' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { seriesId, targetTotal } = body;

    if (!seriesId || !targetTotal) {
      return new Response(JSON.stringify({ error: 'Datos inválidos. Faltan campos obligatorios.' }), { status: 400 });
    }

    const db = getDB(locals.runtime.env);

    // 1. Check if series is app series
    const seriesData = await db.select({ isAppSeries: series.isAppSeries }).from(series).where(eq(series.id, seriesId)).get();

    if (!seriesData || !seriesData.isAppSeries) {
      return new Response(JSON.stringify({ error: 'Esta serie no está configurada como "Solo App".' }), { status: 400 });
    }

    // 2. Get current max chapter number
    const result = await db
      .select({ maxNum: max(chapters.chapterNumber) })
      .from(chapters)
      .where(eq(chapters.seriesId, seriesId))
      .get();
    
    const currentMax = result?.maxNum ?? 0;

    if (currentMax >= targetTotal) {
      return new Response(JSON.stringify({ message: 'La serie ya tiene esa cantidad o más de capítulos.' }), { status: 200 });
    }

    const chaptersToInsert = [];
    // Start from the next integer chapter
    const startNum = Math.floor(currentMax) + 1;
    
    for (let i = startNum; i <= targetTotal; i++) {
      chaptersToInsert.push({
        seriesId,
        chapterNumber: i,
        title: null, // Dejar null para que muestre "Sin título" por defecto
        // Use Math.random for better compatibility than crypto in some dev envs
        telegramFileId: `app_only_${seriesId}_${i}_${Math.random().toString(36).substring(2, 10)}`, 
        status: 'app_only',
        views: 0,
      });
    }

    let addedCount = 0;
    for (const chapter of chaptersToInsert) {
      try {
        await db.insert(chapters).values(chapter).run();
        addedCount++;
      } catch (e: any) {
        // Ignorar errores de unicidad (capítulo ya existe)
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('UNIQUE') || msg.includes('constraint') || msg.includes('SQLITE_CONSTRAINT')) {
           // Silently skip
        } else {
           console.error(`[Bulk Create] Error inserting chapter ${chapter.chapterNumber}:`, e);
        }
      }
    }
    
    return new Response(JSON.stringify({ success: true, added: addedCount }), { status: 200 });

  } catch (error) {
    console.error('[Bulk Create] Critical Error:', error);
    logError(error, 'Error bulk creating chapters');
    return new Response(JSON.stringify({ 
      error: `Error interno: ${error instanceof Error ? error.message : String(error)}` 
    }), { status: 500 });
  }
};
