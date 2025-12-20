// src/pages/api/telegram-webhook.ts
import type { APIRoute } from 'astro';
import { logError } from '../../lib/logError';
import { getDB } from '../../lib/db';
import { series, chapters } from '../../db/schema';
import { eq } from 'drizzle-orm';

interface TelegramUpdate {
  message?: {
    message_thread_id?: number;
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
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const topicId = update.message?.message_thread_id;

    if (update.message?.document?.mime_type === 'application/zip' && topicId) {
      const doc = update.message.document;
      const fileName = doc.file_name;
      const fileId = doc.file_id;

      const chapterNumberMatch = fileName.match(/(\d+(\.\d+)?)/);
      if (!chapterNumberMatch)
        throw new Error(
          `No se pudo extraer el número del capítulo de: ${fileName}`
        );
      const chapterNumber = parseFloat(chapterNumberMatch[0]);

      const drizzleDb = getDB(env);
      let seriesResult = await drizzleDb.select({ id: series.id })
        .from(series)
        .where(eq(series.telegramTopicId, topicId))
        .get();

      if (!seriesResult) {
        const newSeriesTitle = `Serie ${topicId}`;
        const newSeriesSlug = `serie-${topicId}`;
        const placeholderUrl = `${env.R2_PUBLIC_URL_ASSETS}/covers/placeholder-cover.jpg`;
        const insertedSeries = await drizzleDb.insert(series).values({
          title: newSeriesTitle,
          slug: newSeriesSlug,
          description: 'Descripción próximamente...',
          coverImageUrl: placeholderUrl,
          telegramTopicId: topicId,
          isHidden: true,
        }).returning({ id: series.id }).get();
        
        if (!insertedSeries)
          throw new Error('Falló la creación automática de la nueva serie.');
        seriesResult = insertedSeries;
      }

      const seriesId = seriesResult.id;

      const chapterIdResult = await drizzleDb.insert(chapters).values({
        seriesId: seriesId,
        chapterNumber: chapterNumber,
        telegramFileId: fileId,
        status: 'live',
        urlPortada: null,
      }).onConflictDoNothing({ target: [chapters.seriesId, chapters.chapterNumber] })
        .returning({ id: chapters.id })
        .get();

      if (chapterIdResult?.id) {
        const newChapterId = chapterIdResult.id;
        const chapterPlaceholderUrl = `${env.R2_PUBLIC_URL_ASSETS}/covers/placeholder-chapter.jpg`;

        await drizzleDb.update(chapters)
          .set({ urlPortada: chapterPlaceholderUrl })
          .where(eq(chapters.id, newChapterId))
          .run();

        console.log(
          `[Webhook] Capítulo ${chapterNumber} de la serie ${seriesId} registrado con ID: ${newChapterId}.`
        );
      } else {
        console.log(
          `[Webhook] Capítulo ${chapterNumber} de la serie ${seriesId} ya existía o falló el registro.`
        );
      }
      return new Response('OK'); // Explicitly return here
    }
    // If the outer if condition is not met, we still need to return a Response
    return new Response('OK - No zip document or topic ID', { status: 200 });
  } catch (error) {
    logError(error, 'Error en el webhook de Telegram');
    return new Response('Internal Server Error', { status: 500 });
  }
};
