// src/pages/api/series/[slug]/[chapter]/index.ts
import type { APIRoute } from 'astro';
import { processAndCacheChapter } from '../../../../../lib/chapterProcessing';
import { logError } from '../../../../../lib/logError';
import { getDB } from '../../../../../lib/db'; // Import getDB
import { series, chapters } from '../../../../../db/schema'; // Import schemas
import { eq, and } from 'drizzle-orm'; // Import eq for Drizzle queries

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
};

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug, chapter: chapterNumberParam } = params; // Rename chapterNumber to avoid conflict
  const { env, ctx } = locals.runtime;

  if (!slug || !chapterNumberParam) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros' }), {
      status: 400,
    });
  }

  const chapterNumber = parseFloat(chapterNumberParam);

  try {
    const drizzleDb = getDB(env);

    const chapterData = await drizzleDb.select({
      chapterId: chapters.id,
      seriesId: series.id,
      telegramFileId: chapters.telegramFileId,
      chapterCoverUrl: chapters.urlPortada,
    })
      .from(chapters)
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .where(and(eq(series.slug, slug), eq(chapters.chapterNumber, chapterNumber), eq(chapters.status, 'live')))
      .get();

    if (!chapterData) {
      return new Response(
        JSON.stringify({ error: 'Capítulo no encontrado o no disponible' }),
        { status: 404 }
      );
    }

    const manifestKey = `${slug}/${chapterNumber}/manifest.json`;
    const manifestObject = await env.R2_CACHE.get(manifestKey);

    if (manifestObject) {
      const manifestContent = await manifestObject.json();
      return new Response(
        JSON.stringify({
          ...manifestContent,
          seriesId: chapterData.seriesId,
          chapterId: chapterData.chapterId,
          chapterCoverUrl: chapterData.chapterCoverUrl,
        }),
        { status: 200 }
      );
    }

    if (!chapterData.telegramFileId) {
      return new Response(
        JSON.stringify({
          error:
            'El capítulo existe pero no tiene un archivo de Telegram asociado.',
          chapterCoverUrl: chapterData.chapterCoverUrl,
        }),
        { status: 500 }
      );
    }

    // --- Intelligent Response: Stream vs JSON ---
    const acceptHeader = request.headers.get('Accept');
    const wantsStream = acceptHeader && acceptHeader.includes('text/event-stream');

    if (!wantsStream) {
      // Si no pide stream (ej: Astro SSR), disparamos proceso en segundo plano y respondemos 202
      ctx.waitUntil(
        processAndCacheChapter(
          env,
          chapterData.telegramFileId,
          slug,
          chapterNumber
        ).catch(err => logError(err, 'Background processing fail (No-SSE)', { slug, chapterNumber }))
      );

      return new Response(JSON.stringify({
        status: 'processing',
        message: 'El capítulo se está procesando...',
        seriesId: chapterData.seriesId,
        chapterId: chapterData.chapterId,
        chapterCoverUrl: chapterData.chapterCoverUrl,
      }), { 
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- SSE Implementation when manifest is not found and client wants stream ---
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = async (data: object, eventType = 'message', id?: string) => {
      let message = '';
      if (id) message += `id: ${id}\n`;
      message += `event: ${eventType}\n`;
      message += `data: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Start background processing
    ctx.waitUntil(
      processAndCacheChapter(
        env,
        chapterData.telegramFileId,
        slug,
        chapterNumber
      ).catch((err) => {
        const slugForLog = slug;
        const chapterNumberForLog = chapterNumber;
        logError(err, 'Fallo en el procesamiento en segundo plano para el capítulo', { slug: slugForLog, chapterNumber: chapterNumberForLog });
        // Attempt to send an error event if processing fails
        sendEvent({ error: 'Fallo al procesar el capítulo' }, 'error').catch(err => {
          const slugForLogError = slug; // Define again for inner catch
          const chapterNumberForLogError = chapterNumber; // Define again for inner catch
          logError(err, 'Fallo al enviar evento de error SSE', { slug: slugForLogError, chapterNumber: chapterNumberForLogError });
        });
        writer.close();
      })
    );

    // Stream updates
    let attempts = 0;
    const maxAttempts = 60; // Max 5 minutes (5 seconds * 60 attempts)
    const intervalMs = 5000; // Check every 5 seconds

    const checkProcessingStatus = async () => {
      while (attempts < maxAttempts) {
        attempts++;
        try {
          const updatedManifestObject = await env.R2_CACHE.get(manifestKey);
          if (updatedManifestObject) {
            const manifestContent = await updatedManifestObject.json();
            await sendEvent(
              {
                ...manifestContent,
                seriesId: chapterData.seriesId,
                chapterId: chapterData.chapterId,
                chapterCoverUrl: chapterData.chapterCoverUrl,
              },
              'completed'
            );
            writer.close();
            return;
          } else {
            await sendEvent({ message: 'Procesando capítulo...', attempt: attempts }, 'processing');
          }
        } catch (e) {
          const slugForLogError = slug; // Define again for inner catch
          const chapterNumberForLogError = chapterNumber; // Define again for inner catch
          logError(e, 'Error al verificar el manifiesto en R2 durante SSE', { slug: slugForLogError, chapterNumber: chapterNumberForLogError, attempt: attempts });
          await sendEvent({ error: 'Error al verificar el progreso' }, 'error');
          writer.close();
          return;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      // If max attempts reached without completion
      await sendEvent({ error: 'Tiempo de procesamiento agotado' }, 'error');
      writer.close();
    };

    // Start checking status in a non-blocking way
    ctx.waitUntil(checkProcessingStatus());

    // Return the readable stream immediately
    return new Response(readable, { headers: sseHeaders });
  } catch (error: unknown) {
    const slugForLog = slug;
    const chapterNumberForLog = chapterNumber;
    logError(error, 'Error al obtener el capítulo desde el API', { slug: slugForLog, chapterNumber: chapterNumberForLog });
    return new Response(
      JSON.stringify({
        error:
          (error instanceof Error ? error.message : String(error)) ||
          'Error interno del servidor',
      }),
      { status: 500 }
    );
  }
};
