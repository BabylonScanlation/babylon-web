// src/pages/api/series/[slug]/[chapter]/index.ts
import type { APIRoute } from 'astro';
import { processAndCacheChapter } from '../../../../../lib/chapterProcessing';

export const GET: APIRoute = async ({ params, locals }) => {
  const { slug, chapter: chapterNumber } = params;
  const { db, runtime } = locals;
  const { env, ctx } = runtime;

  if (!slug || !chapterNumber) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros' }), {
      status: 400,
    });
  }

  try {
    const chapterQuery = `
        SELECT c.id as chapterId, s.id as seriesId, c.telegram_file_id as telegramFileId
        FROM Chapters c
        JOIN Series s ON c.series_id = s.id
        WHERE s.slug = ?1 AND c.chapter_number = ?2 AND c.status = 'live'
    `;
    const chapterData = await db
      .prepare(chapterQuery)
      .bind(slug, chapterNumber)
      .first<{ chapterId: number; seriesId: number; telegramFileId: string }>();

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
        }),
        { status: 200 }
      );
    }

    if (!chapterData.telegramFileId) {
      return new Response(
        JSON.stringify({
          error:
            'El capítulo existe pero no tiene un archivo de Telegram asociado.',
        }),
        { status: 500 }
      );
    }

    // --- INICIO DE LA CORRECCIÓN ---
    // Le decimos a Cloudflare: "Ejecuta esto, y si falla, solo regístralo en la consola".
    ctx.waitUntil(
      processAndCacheChapter(
        env,
        chapterData.telegramFileId,
        slug,
        parseFloat(chapterNumber)
      ).catch((err) =>
        console.error(
          `Fallo en el procesamiento en segundo plano para ${slug}/${chapterNumber}:`,
          err
        )
      )
    );
    // --- FIN DE LA CORRECCIÓN ---

    return new Response(
      JSON.stringify({
        message:
          'Aguarde, el capítulo se está cargando desde nuestros servidores. Esto puede tardar unos segundos.',
        seriesId: chapterData.seriesId,
        chapterId: chapterData.chapterId,
      }),
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error(
      `Error al obtener el capítulo ${slug}/${chapterNumber}:`,
      error
    );
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
