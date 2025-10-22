// src/pages/api/telegram-webhook.ts
import type { APIRoute } from 'astro';

// Define interface for Telegram getFile response
interface TelegramFileResponse {
  ok: boolean;
  result: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string; // This is what we need
  };
}

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
    const update = await request.json<TelegramUpdate>();
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

      const db = env.DB;
      let seriesResult = await db
        .prepare('SELECT id FROM Series WHERE telegram_topic_id = ?')
        .bind(topicId)
        .first<{ id: number }>();

      if (!seriesResult) {
        const newSeriesTitle = `Serie ${topicId}`;
        const newSeriesSlug = `serie-${topicId}`;
        const placeholderUrl = `${env.R2_PUBLIC_URL_ASSETS}/covers/placeholder-cover.jpg`;
        await db
          .prepare(
            'INSERT INTO Series (title, slug, description, cover_image_url, telegram_topic_id, is_hidden) VALUES (?, ?, ?, ?, ?, TRUE)'
          )
          .bind(
            newSeriesTitle,
            newSeriesSlug,
            'Descripción próximamente...',
            placeholderUrl,
            topicId
          )
          .run();
        seriesResult = await db
          .prepare('SELECT id FROM Series WHERE telegram_topic_id = ?')
          .bind(topicId)
          .first<{ id: number }>();
        if (!seriesResult)
          throw new Error('Falló la creación automática de la nueva serie.');
      }

      const seriesId = seriesResult.id;

      const chapterIdResult = await db
        .prepare(
          "INSERT OR IGNORE INTO Chapters (series_id, chapter_number, telegram_file_id, status, url_portada) VALUES (?, ?, ?, 'live', NULL) RETURNING id"
        )
        .bind(seriesId, chapterNumber, fileId)
        .first<{ id: number }>();

      if (chapterIdResult?.id) {
        const newChapterId = chapterIdResult.id;
        const chapterPlaceholderUrl = `${env.R2_PUBLIC_URL_ASSETS}/covers/placeholder-chapter.jpg`; // New placeholder for chapters

        // Update the chapter with the placeholder URL immediately after insertion
        await db.prepare('UPDATE Chapters SET url_portada = ? WHERE id = ?')
          .bind(chapterPlaceholderUrl, newChapterId)
          .run();

        console.log(
          `[Webhook] Capítulo ${chapterNumber} de la serie ${seriesId} registrado con ID: ${newChapterId}.`
        );

        const telegramFileResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const telegramFileData: TelegramFileResponse = await telegramFileResponse.json();

        if (!telegramFileData.ok) {
            console.error('[Webhook] Error getting Telegram file path:', telegramFileData);
            throw new Error('Failed to get Telegram file path.');
        }

        const filePath = telegramFileData.result.file_path;
        const originalImageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;


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
    console.error('Error en el webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};