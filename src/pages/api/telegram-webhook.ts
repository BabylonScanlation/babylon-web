// src/pages/api/telegram-webhook.ts
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { chapters, series } from '../../db/schema';
import { getDB } from '../../lib/db';
import { logError } from '../../lib/logError';
import { siteConfig } from '../../site.config';

interface TelegramUpdate {
  message?: {
    message_thread_id?: number;
    chat?: any;
    document?: {
      mime_type: string;
      file_name: string;
      file_id: string;
    };
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
    console.error('[Webhook] Unauthorized: Invalid secret token');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;

    const topicId = update.message?.message_thread_id;
    const doc = update.message?.document;

    if (doc?.mime_type === 'application/zip' && topicId) {
      const fileName = doc.file_name;
      const fileId = doc.file_id;

      const chapterNumberMatch = fileName.match(/(\d+(\.\d+)?)/);
      if (!chapterNumberMatch) {
        console.error(`[Webhook] Error: No se pudo extraer el número del capítulo de: ${fileName}`);
        return new Response('OK - Invalid filename', { status: 200 }); // Return OK to avoid Telegram retries
      }
      const chapterNumber = parseFloat(chapterNumberMatch[0]);

      const drizzleDb = getDB(env);

      // 1. Buscar la serie
      let seriesResult = await drizzleDb
        .select({ id: series.id, title: series.title })
        .from(series)
        .where(eq(series.telegramTopicId, topicId))
        .get();

      if (!seriesResult) {
        const newSeriesTitle = `Serie ${topicId}`;
        const newSeriesSlug = `serie-${topicId}`;
        const placeholderUrl = `${env.R2_PUBLIC_URL_ASSETS}${siteConfig.assets.placeholderCover}`;

        try {
          seriesResult = await drizzleDb
            .insert(series)
            .values({
              title: newSeriesTitle,
              slug: newSeriesSlug,
              description: 'Descripción próximamente...',
              coverImageUrl: placeholderUrl,
              telegramTopicId: topicId,
              isHidden: true,
              createdAt: new Date(),
            })
            .returning({ id: series.id, title: series.title })
            .get();
        } catch (e: any) {
          if (e.message?.includes('UNIQUE constraint failed')) {
            seriesResult = await drizzleDb
              .select({ id: series.id, title: series.title })
              .from(series)
              .where(eq(series.telegramTopicId, topicId))
              .get();
          } else {
            console.error('[Webhook] Error crítico al crear serie automática:', e);
            throw e;
          }
        }
      }

      if (!seriesResult) {
        console.error(
          `[Webhook] Error fatal: No se pudo obtener ni crear la serie para el topic ${topicId}`
        );
        throw new Error('No se pudo obtener o crear la serie.');
      }

      const seriesId = seriesResult.id;

      // 2. Verificar duplicados (Capítulo o TelegramFileId)
      const existingChapter = await drizzleDb
        .select({
          id: chapters.id,
          telegramFileId: chapters.telegramFileId,
          status: chapters.status,
        })
        .from(chapters)
        .where(and(eq(chapters.seriesId, seriesId), eq(chapters.chapterNumber, chapterNumber)))
        .get();

      if (existingChapter) {
        // Orion: Si ya existe (ya sea app_only o live), permitimos actualizarlo.
        // Esto soluciona el problema de "borrar y volver a subir" en Telegram para corregir errores.
        const chapterPlaceholderUrl = `${env.R2_PUBLIC_URL_ASSETS}${siteConfig.assets.placeholderChapter}`;

        await drizzleDb
          .update(chapters)
          .set({
            telegramFileId: fileId,
            status: 'live',
            urlPortada: chapterPlaceholderUrl,
            createdAt: new Date(),
          })
          .where(eq(chapters.id, existingChapter.id))
          .run();

        return new Response('OK - Updated existing chapter');
      }

      // 3. Insertar nuevo capítulo
      try {
        const chapterIdResult = await drizzleDb
          .insert(chapters)
          .values({
            seriesId: seriesId,
            chapterNumber: chapterNumber,
            telegramFileId: fileId,
            status: 'live',
            urlPortada: null,
            createdAt: new Date(), // Fijar fecha explícita para evitar problemas de default/formato
          })
          .returning({ id: chapters.id })
          .get();

        if (chapterIdResult?.id) {
          const newChapterId = chapterIdResult.id;
          const chapterPlaceholderUrl = `${env.R2_PUBLIC_URL_ASSETS}${siteConfig.assets.placeholderChapter}`;

          await drizzleDb
            .update(chapters)
            .set({ urlPortada: chapterPlaceholderUrl })
            .where(eq(chapters.id, newChapterId))
            .run();
        }
      } catch (insertError: any) {
        if (insertError.message?.includes('UNIQUE constraint failed')) {
          return new Response('OK - Unique constraint conflict', { status: 200 });
        }
        console.error('[Webhook] Error en la inserción del capítulo:', insertError);
        throw insertError;
      }

      return new Response('OK');
    }

    return new Response('OK - Ignored', { status: 200 });
  } catch (error) {
    logError(error, 'Error en el webhook de Telegram');
    return new Response('Internal Server Error', { status: 500 });
  }
};
