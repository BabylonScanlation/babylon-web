import { env } from 'cloudflare:workers';
// src/pages/api/telegram-webhook.ts
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { chapters, series } from '../../db/schema';
import { getDB } from '../../lib/db';
import { siteConfig } from '../../site.config';

interface TelegramUpdate {
  message?: {
    message_thread_id?: number;
    chat?: unknown;
    document?: {
      mime_type: string;
      file_name: string;
      file_id: string;
    };
  };
}

export const POST: APIRoute = async ({ request }) => {
  const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
    console.error('[Webhook] Unauthorized: Invalid secret token');
    return new Response('Unauthorized', { status: 401 });
  }

  const drizzleDb = getDB(env);

  try {
    const update = (await request.json()) as TelegramUpdate;

    const topicId = update.message?.message_thread_id;
    const doc = update.message?.document;

    if (!doc || !topicId) {
      return new Response('OK - Ignored (No document or topic)', { status: 200 });
    }

    const fileName = doc.file_name || '';
    const fileId = doc.file_id;
    const isZip =
      doc.mime_type === 'application/zip' ||
      doc.mime_type === 'application/x-zip-compressed' ||
      fileName.toLowerCase().endsWith('.zip');

    if (!isZip) {
      return new Response('OK - Ignored (Not a ZIP)', { status: 200 });
    }

    const chapterNumberMatch = fileName.match(/(\d+(\.\d+)?)/);
    if (!chapterNumberMatch) {
      console.error(
        `[Webhook] Error: No se pudo extraer el número del capítulo de: ${fileName}`
      );
      return new Response('OK - Invalid filename', { status: 200 });
    }

    const chapterNumber = parseFloat(chapterNumberMatch[0]);
    const isNsfw = /nsfw/i.test(fileName);

    // 1. Buscar la serie por topicId
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
            createdAt: new Date().toISOString(),
          })
          .returning({ id: series.id, title: series.title })
          .get();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes('UNIQUE constraint failed')) {
          seriesResult = await drizzleDb
            .select({ id: series.id, title: series.title })
            .from(series)
            .where(eq(series.telegramTopicId, topicId))
            .get();
        }
        if (!seriesResult) {
          console.error('[Webhook] Error crítico al crear serie automática:', message);
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

    // 2. Verificar si ya existe este capítulo con el mismo isNsfw
    const existingChapter = await drizzleDb
      .select({
        id: chapters.id,
        telegramFileId: chapters.telegramFileId,
        status: chapters.status,
      })
      .from(chapters)
      .where(
        and(
          eq(chapters.seriesId, seriesId),
          eq(chapters.chapterNumber, chapterNumber),
          eq(chapters.isNsfw, isNsfw)
        )
      )
      .get();

    const chapterPlaceholderUrl = `${env.R2_PUBLIC_URL_ASSETS}${siteConfig.assets.placeholderChapter}`;

    if (existingChapter) {
      // Orion: Si ya existe, permitimos actualizarlo.
      // Esto soluciona el problema de "borrar y volver a subir" en Telegram para corregir errores.
      await drizzleDb
        .update(chapters)
        .set({
          telegramFileId: fileId,
          status: 'live',
          urlPortada: chapterPlaceholderUrl,
          createdAt: new Date().toISOString(),
        })
        .where(eq(chapters.id, existingChapter.id))
        .run();

      return new Response('OK - Updated existing chapter');
    }

    // 3. Insertar nuevo capítulo
    try {
      await drizzleDb
        .insert(chapters)
        .values({
          seriesId: seriesId,
          chapterNumber: chapterNumber,
          telegramFileId: fileId,
          isNsfw: isNsfw,
          status: 'live',
          urlPortada: chapterPlaceholderUrl,
          createdAt: new Date().toISOString(),
        })
        .returning({ id: chapters.id })
        .get();

      return new Response('OK - Inserted new chapter');
    } catch (insertError: unknown) {
      const message = insertError instanceof Error ? insertError.message : String(insertError);
      if (message.includes('UNIQUE constraint failed')) {
        // Orion: Si hubo un conflicto de unicidad concurrente, recuperamos con UPDATE
        await drizzleDb
          .update(chapters)
          .set({
            telegramFileId: fileId,
            status: 'live',
            urlPortada: chapterPlaceholderUrl,
            createdAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(chapters.seriesId, seriesId),
              eq(chapters.chapterNumber, chapterNumber),
              eq(chapters.isNsfw, isNsfw)
            )
          )
          .run();

        return new Response('OK - Recovered from unique constraint conflict', { status: 200 });
      }
      console.error('[Webhook] Error en la inserción del capítulo:', message);
      throw insertError;
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Webhook] Unhandled error:', errMsg);
    // Devolver 200 para evitar reintentos infinitos de Telegram
    return new Response('OK - Internal error logged', { status: 200 });
  }
};
