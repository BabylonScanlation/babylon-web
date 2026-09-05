import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { and, eq, gte, sql } from 'drizzle-orm';
import { chapterDownloads, chapters, series } from '../../../../../db/schema';
import { getDB } from '../../../../../lib/db';
import { logError } from '../../../../../lib/logError';

export const GET: APIRoute = async ({ params, locals, request }) => {
  const { slug, chapter: chapterNumberParam } = params;
  const url = new URL(request.url);
  const targetChapterId = url.searchParams.get('id');

  const user = locals.user;
  const isStaff = locals.isStaff;

  if (!user && !isStaff) {
    return new Response(JSON.stringify({ error: 'No autorizado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isAdmin = user?.isAdmin || isStaff;
  const vipTier = user?.vipTier ?? 0;

  if (!isAdmin && vipTier < 3) {
    return new Response(
      JSON.stringify({ error: 'Esta función requiere ser VIP Nivel 3 o superior.' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!slug || !chapterNumberParam) {
    return new Response(JSON.stringify({ error: 'Parámetros inválidos.' }), { status: 400 });
  }

  const chapterNumber = parseFloat(chapterNumberParam);

  try {
    const drizzleDb = getDB(env);

    // 1. Fetch chapter from DB
    const chapterData = await drizzleDb
      .select({
        chapterId: chapters.id,
        telegramFileId: chapters.telegramFileId,
        isNsfw: chapters.isNsfw,
      })
      .from(chapters)
      .innerJoin(series, eq(chapters.seriesId, series.id))
      .where(
        and(
          eq(series.slug, slug),
          eq(chapters.chapterNumber, chapterNumber),
          targetChapterId ? eq(chapters.id, parseInt(targetChapterId, 10)) : undefined
        )
      )
      .get();

    if (!chapterData) {
      return new Response(JSON.stringify({ error: 'Capítulo no encontrado.' }), { status: 404 });
    }

    // 2. Enforce Monthly Quotas for Nivel 3 (Nivel 4+ is unlimited)
    if (!isAdmin && vipTier === 3 && user?.uid) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const countRes = await drizzleDb
        .select({ count: sql<number>`count(*)` })
        .from(chapterDownloads)
        .where(
          and(
            eq(chapterDownloads.userId, user.uid),
            gte(chapterDownloads.downloadedAt, startOfMonth)
          )
        )
        .get();

      const downloadsThisMonth = countRes?.count ?? 0;
      const MAX_DOWNLOADS_NIVEL_3 = 10;

      if (downloadsThisMonth >= MAX_DOWNLOADS_NIVEL_3) {
        return new Response(
          JSON.stringify({
            error: `Has alcanzado tu límite de ${MAX_DOWNLOADS_NIVEL_3} descargas este mes. (Nivel 3)`,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Increment quota
      await drizzleDb
        .insert(chapterDownloads)
        .values({
          userId: user.uid,
          chapterId: chapterData.chapterId,
        })
        .run();
    }

    // 3. Fetch file path from Telegram
    interface TelegramFileResponse {
      ok: boolean;
      result?: { file_path?: string };
      description?: string;
    }
    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${chapterData.telegramFileId}`;
    const rawFileInfo = (await fetch(fileInfoUrl).then((res) =>
      res.json()
    )) as TelegramFileResponse;

    if (!rawFileInfo.ok || !rawFileInfo.result?.file_path) {
      throw new Error(rawFileInfo.description || 'No se pudo obtener el archivo de Telegram');
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${rawFileInfo.result.file_path}`;

    // 4. Proxy the file download
    const tgRes = await fetch(fileUrl);
    if (!tgRes.ok || !tgRes.body) {
      throw new Error('Fallo al descargar de Telegram');
    }

    const filename = `${slug}-capitulo-${chapterNumber}${chapterData.isNsfw ? '-nsfw' : ''}.cbz`;

    return new Response(tgRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.comicbook+zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logError(error, 'Error al procesar la descarga', { slug, chapterNumber });
    return new Response(JSON.stringify({ error: 'Error interno al procesar la descarga.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
