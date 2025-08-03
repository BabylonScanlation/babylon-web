// src/pages/api/telegram-webhook.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = await request.json<any>();
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
            'INSERT INTO Series (title, slug, description, cover_image_url, telegram_topic_id) VALUES (?, ?, ?, ?, ?)'
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

      await db
        .prepare(
          "INSERT OR IGNORE INTO Chapters (series_id, chapter_number, telegram_file_id, status) VALUES (?, ?, ?, 'live')"
        )
        .bind(seriesId, chapterNumber, fileId)
        .run();

      console.log(
        `[Webhook] Capítulo ${chapterNumber} de la serie ${seriesId} registrado. Listo para procesamiento bajo demanda.`
      );
    }

    return new Response('OK');
  } catch (error) {
    console.error('Error en el webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
