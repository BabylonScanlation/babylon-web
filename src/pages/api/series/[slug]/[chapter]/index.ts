/* eslint-disable */
// src/pages/api/series/[slug]/[chapter]/index.ts
import type { APIRoute } from 'astro';
import { and, eq, inArray } from 'drizzle-orm';
import { chapters, series } from '../../../../../db/schema';
import { processAndCacheChapter } from '../../../../../lib/chapterProcessing';
import { signManifest } from '../../../../../lib/crypto';
import { getDB } from '../../../../../lib/db';
import { logError } from '../../../../../lib/logError';

const sseHeaders = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { slug, chapter: chapterNumberParam } = params;
  console.log(`[API_CH] Request received for: ${slug} / ${chapterNumberParam}`);

  const runtime = locals.runtime || {};
  const env = runtime.env;
  const ctx = runtime.ctx;

  if (!env) {
    return new Response(JSON.stringify({ error: 'Environment configuration missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!slug || !chapterNumberParam) {
    console.error('[API_CH] Error: Missing required params.');
    return new Response(JSON.stringify({ error: 'Faltan parámetros obligatorios.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const chapterNumber = parseFloat(chapterNumberParam);

  try {
    const drizzleDb = getDB(env);
    console.log('[API_CH] DB connected. Querying chapter details...');

    const retryGetFromR2 = async (key: string, maxAttempts = 3) => {
      let lastError = null;
      for (let i = 0; i < maxAttempts; i++) {
        try {
          // ORION: Forzamos que no haya caché en la lectura de R2 para el manifiesto
          return await env.R2_CACHE.get(key, {
            onlyIf: {
              // Opcional: Podrías usar etags aquí, pero el get directo es más seguro para validación extrema
            },
          });
        } catch (e) {
          lastError = e;
          if (i < maxAttempts - 1) await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      throw lastError;
    };

    const chapterData = await drizzleDb
      .select({
        chapterId: chapters.id,
        seriesId: chapters.seriesId,
        telegramFileId: chapters.telegramFileId,
        chapterCoverUrl: chapters.urlPortada,
        status: chapters.status,
      })
      .from(chapters)
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .where(
        and(
          eq(series.slug, slug),
          eq(chapters.chapterNumber, chapterNumber),
          inArray(chapters.status, ['live', 'app_only', 'processing'])
        )
      )
      .get();

    if (!chapterData) {
      console.warn(`[API_CH] Chapter not found in DB: ${slug}#${chapterNumber}`);
      return new Response(
        JSON.stringify({ error: 'El capítulo solicitado no fue encontrado o no está disponible.' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[API_CH] Chapter found (ID: ${chapterData.chapterId}). Manifest key: ${slug}/${chapterNumber}/manifest.json`
    );
    const manifestKey = `${slug}/${chapterNumber}/manifest.json`;
    const manifestObject = await retryGetFromR2(manifestKey);

    const acceptHeader = request.headers.get('Accept');
    const wantsStream = acceptHeader?.includes('text/event-stream');

    if (manifestObject) {
      console.log('[API_CH] Manifest found in R2. Processing content...');
      const manifestContent = await manifestObject.json();

      // Use centralized signManifest
      const signedManifest = await signManifest(manifestContent, env.AUTH_SECRET);

      const responseData = {
        ...signedManifest,
        seriesId: chapterData.seriesId,
        chapterId: chapterData.chapterId,
        chapterCoverUrl: chapterData.chapterCoverUrl,
      };

      if (wantsStream) {
        console.log('[API_CH] Delivery mode: SSE Stream (Manifest found)');
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        ctx.waitUntil(
          (async () => {
            try {
              await writer.write(encoder.encode(': connected\n\n'));
              const message = `event: completed\ndata: ${JSON.stringify({ payload: responseData })}\n\n`;
              await writer.write(encoder.encode(message));
              await writer.close();
            } catch (e) {
              console.error('[API_CH] SSE Direct Manifest Error:', e);
            }
          })()
        );

        return new Response(readable, { headers: sseHeaders });
      }

      console.log('[API_CH] Delivery mode: JSON (200 OK)');
      return new Response(JSON.stringify({ payload: responseData }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- TRIGGER PROCESSING IF MANIFEST NOT FOUND ---
    console.log('[API_CH] Manifest NOT found. Ensuring processor is active...');
    const lockAcquired = await drizzleDb
      .update(chapters)
      .set({ status: 'processing' })
      .where(and(eq(chapters.id, chapterData.chapterId), eq(chapters.status, 'live')))
      .run();

    if (lockAcquired.meta.changes > 0) {
      console.log(
        '[API_CH] 🚀 FIRE START: Processing lock acquired. Dispatching background worker...'
      );
      ctx.waitUntil(
        processAndCacheChapter(
          env,
          chapterData.telegramFileId,
          slug,
          chapterNumber,
          chapterData.chapterId
        ).catch((err) => logError(err, 'Background processing fail', { slug, chapterNumber }))
      );
    } else {
      console.log('[API_CH] Processor already running or chapter is app_only.');
    }

    if (!wantsStream) {
      console.log('[API_CH] Delivery mode: JSON (202 Accepted)');
      return new Response(
        JSON.stringify({
          payload: {
            status: 'processing',
            seriesId: chapterData.seriesId,
            chapterId: chapterData.chapterId,
          },
        }),
        { status: 202 }
      );
    }

    console.log('[API_CH] Delivery mode: SSE Stream (Waiting loop)...');
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const checkProcessingStatus = async () => {
      try {
        await writer.write(encoder.encode(': connected\n\n'));

        // LIGHTSPEED POLLING STRATEGY
        // El Virtual Manifest debería estar listo en < 2 segundos.
        // Hacemos polling agresivo al principio.
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
          attempts++;
          // Intervalo dinámico: Rápido al principio (500ms), luego más lento (2s)
          const interval = attempts <= 10 ? 500 : 2000;

          // No logueamos cada intento rápido para no saturar logs
          if (attempts % 5 === 0)
            console.log(`[API_CH] SSE Loop: Polling manifest (${attempts}/${maxAttempts})...`);

          const updatedManifest = await retryGetFromR2(manifestKey, 1).catch(() => null);

          if (updatedManifest) {
            console.log('[API_CH] ⚡ Lightspeed: Manifest DETECTED! Sending completed event.');
            const content = await updatedManifest.json();
            const signed = await signManifest(content, env.AUTH_SECRET);
            const message = `event: completed\ndata: ${JSON.stringify({ payload: { ...signed, chapterId: chapterData.chapterId } })}\n\n`;
            await writer.write(encoder.encode(message));
            await writer.close();
            return;
          }

          // Mensajes rotativos para el usuario
          if (attempts % 4 === 0) {
            // Enviar mensaje cada ~2 segundos
            const messages = [
              'Iniciando motores Lightspeed...',
              'Analizando estructura del capítulo...',
              'Generando manifiesto virtual...',
              'Casi listo...',
            ];
            const msgIndex = Math.floor((attempts / 4) % messages.length);
            await writer.write(
              encoder.encode(
                `event: processing\ndata: ${JSON.stringify({ payload: { message: messages[msgIndex] } })}\n\n`
              )
            );
          }

          await new Promise((r) => setTimeout(r, interval));
        }
        console.warn('[API_CH] SSE Loop: Timeout reached. Informing client.');
        const timeoutMsg = `event: timeout\ndata: ${JSON.stringify({ payload: { message: 'El procesamiento está tardando más de lo esperado. Por favor, refresca en unos momentos.' } })}\n\n`;
        await writer.write(encoder.encode(timeoutMsg));
        await writer.close();
      } catch (_streamErr) {
        console.warn('[API_CH] SSE Loop: Stream interrupted.');
      }
    };

    ctx.waitUntil(checkProcessingStatus());
    return new Response(readable, { headers: sseHeaders });
  } catch (error) {
    logError(error, 'Error crítico en API de capítulos', { slug, chapter: chapterNumberParam });
    return new Response(JSON.stringify({ error: 'Internal Error' }), { status: 500 });
  }
};
