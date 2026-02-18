import { createApiRoute } from '../../../../lib/api';
import { getDB } from '../../../../lib/db';
import { series } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { logError } from '../../../../lib/logError';

export const POST = createApiRoute({ auth: 'admin' }, async ({ request, locals }) => {
  const env = locals.runtime.env;
  const db = getDB(env);

  try {
    const formData = await request.formData();
    const seriesId = formData.get('seriesId')?.toString();
    const zipFile = formData.get('file');

    if (!seriesId || !zipFile || !(zipFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Faltan datos obligatorios (Serie o Archivo ZIP).' }), { status: 400 });
    }

    // 1. Obtener Topic ID de la serie
    const seriesData = await db.select({
      topicId: series.telegramTopicId,
      title: series.title,
      slug: series.slug
    })
    .from(series)
    .where(eq(series.id, parseInt(seriesId)))
    .get();

    if (!seriesData || !seriesData.topicId) {
      return new Response(JSON.stringify({ error: 'La serie no existe o no tiene un Topic de Telegram asignado.' }), { status: 404 });
    }

    const tgFormData = new FormData();
    tgFormData.append('chat_id', env.TELEGRAM_CHAT_ID);
    tgFormData.append('message_thread_id', seriesData.topicId.toString());
    tgFormData.append('document', zipFile, zipFile.name); // Reenviamos el blob con nombre

    // 3. Enviar a Telegram
    const tgResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: tgFormData
    });

    const tgResult: any = await tgResponse.json();

    if (!tgResult.ok) {
      logError(tgResult, 'Error de Telegram API al subir capítulo');
      return new Response(JSON.stringify({ 
        error: 'Telegram rechazó el archivo.', 
        details: tgResult.description 
      }), { status: 502 });
    }

    // 4. Registrar en la Base de Datos (D1)
    const fileName = zipFile.name;
    const fileId = tgResult.result.document.file_id;
    const { chapters } = await import('../../../../db/schema');
    const { and } = await import('drizzle-orm');
    const { processAndCacheChapter } = await import('../../../../lib/chapterProcessing');
    
    const chapterNumberMatch = fileName.match(/(\d+(\.\d+)?)/);
    if (!chapterNumberMatch) {
      return new Response(JSON.stringify({ 
        error: `No se pudo extraer el número del capítulo del archivo: ${fileName}`,
        success: true,
        telegramMessageId: tgResult.result.message_id
      }), { status: 422 });
    }
    
    const chapterNumber = parseFloat(chapterNumberMatch[0]);
    let registeredChapterId: number | undefined;

    try {
      const existing = await db.select()
        .from(chapters)
        .where(
          and(
            eq(chapters.seriesId, parseInt(seriesId)),
            eq(chapters.chapterNumber, chapterNumber)
          )
        )
        .get();

      if (!existing) {
        const insertResult = await db.insert(chapters).values({
          seriesId: parseInt(seriesId),
          chapterNumber: chapterNumber,
          telegramFileId: fileId,
          status: 'processing', // Orion: Empezamos en processing porque disparamos el worker ahora
          urlPortada: `${env.R2_PUBLIC_URL_ASSETS}/covers/placeholder-chapter.jpg`,
          createdAt: new Date(),
        }).returning({ id: chapters.id });
        registeredChapterId = insertResult[0]?.id;
      } else {
        await db.update(chapters)
          .set({ 
            telegramFileId: fileId,
            status: 'processing',
            createdAt: new Date() 
          })
          .where(eq(chapters.id, existing.id));
        registeredChapterId = existing.id;
      }

      // Orion: DISPARAR PROCESAMIENTO INMEDIATO EN BACKGROUND
      if (registeredChapterId && locals.runtime?.ctx) {
        locals.runtime.ctx.waitUntil(
          processAndCacheChapter(
            env, 
            fileId, 
            seriesData.slug, 
            chapterNumber, 
            registeredChapterId
          ).catch(err => console.error('[Background Process Error]', err))
        );
      }

    } catch (dbError) {
      logError(dbError, 'Error al registrar capítulo en DB');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Capítulo subido y registrado correctamente.',
      chapterNumber,
      telegramMessageId: tgResult.result.message_id
    }), { status: 200 });

  } catch (error) {
    logError(error, 'Excepción al subir capítulo a Telegram');
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 });
  }
});
