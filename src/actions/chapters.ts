import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { and, eq, max, sql } from 'drizzle-orm';
import { chapters, chapterViews as chapterViewsTable, comments, pages, series } from '../db/schema';
import { processAndCacheChapter } from '../lib/chapterProcessing';
import { hashIpAddress } from '../lib/crypto';
import { getDB } from '../lib/db';
import { logError } from '../lib/logError';

export const chapterActions = {
  getProcessingStatus: defineAction({
    input: z.object({
      chapterId: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) return { status: 'unauthorized' };

      const { chapterId } = input;
      const db = getDB(context.locals.runtime.env);
      const data = await db
        .select({ status: chapters.status })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .get();

      return { status: data?.status || 'not_found' };
    },
  }),

  registerView: defineAction({
    input: z.object({
      chapterId: z.number(),
    }),
    handler: async (input, context) => {
      const { chapterId } = input;
      const { env, ctx } = context.locals.runtime;
      const { user } = context.locals;
      const { cookies } = context;
      const clientAddress = context.clientAddress;

      const runBackgroundLogic = async () => {
        try {
          const kv = env.KV_VIEWS;
          const ipHash = await hashIpAddress(clientAddress || '0.0.0.0');
          const viewKey = `cv:${chapterId}:${ipHash}`;

          if (kv) {
            const alreadyViewed = await kv.get(viewKey);
            if (alreadyViewed) return;
            await kv.put(viewKey, '1', { expirationTtl: 86400 });
          }

          const db = getDB(env);
          const guestId = cookies.get('guestId')?.value || null;
          const userId = user?.uid || null;

          await db
            .insert(chapterViewsTable)
            .values({
              chapterId,
              ipAddress: ipHash,
              guestId,
              userId,
              viewedAt: sql`CURRENT_TIMESTAMP`,
            })
            .onConflictDoNothing()
            .run();
        } catch (err) {
          console.error('[Action chapter registerView Error]', err);
        }
      };

      if (ctx?.waitUntil) ctx.waitUntil(runBackgroundLogic());
      else runBackgroundLogic();

      return { success: true };
    },
  }),

  deleteBulk: defineAction({
    input: z.object({
      chapterIds: z.array(z.number()),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { chapterIds } = input;
      const db = getDB(context.locals.runtime.env);
      const r2Cache = context.locals.runtime.env.R2_CACHE;

      for (const id of chapterIds) {
        const pagesToDelete = await db
          .select({ imageUrl: pages.imageUrl })
          .from(pages)
          .where(eq(pages.chapterId, id))
          .all();

        if (pagesToDelete.length > 0 && r2Cache) {
          const keys = pagesToDelete
            .map((p) => p.imageUrl.split('/').pop() || p.imageUrl)
            .filter((k) => k);
          if (keys.length > 0) await r2Cache.delete(keys).catch(() => {});
        }

        await db.delete(pages).where(eq(pages.chapterId, id)).run();
        await db.delete(comments).where(eq(comments.chapterId, id)).run();
        const { chapterViews } = await import('../db/schema');
        await db.delete(chapterViews).where(eq(chapterViews.chapterId, id)).run();

        await db.delete(chapters).where(eq(chapters.id, id)).run();
      }

      return { success: true, deletedCount: chapterIds.length };
    },
  }),

  upload: defineAction({
    accept: 'form',
    input: z.object({
      seriesId: z.string().transform((v) => parseInt(v, 10)),
      file: z.instanceof(File),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { seriesId, file } = input;
      const { env } = context.locals.runtime;
      const db = getDB(env);

      const seriesData = await db
        .select({
          topicId: series.telegramTopicId,
          slug: series.slug,
        })
        .from(series)
        .where(eq(series.id, seriesId))
        .get();

      if (!seriesData || !seriesData.topicId) {
        throw new Error('La serie no tiene un Topic de Telegram asignado');
      }

      const tgFormData = new FormData();
      tgFormData.append('chat_id', env.TELEGRAM_CHAT_ID);
      tgFormData.append('message_thread_id', seriesData.topicId.toString());
      tgFormData.append('document', file, file.name);

      const tgResponse = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`,
        {
          method: 'POST',
          body: tgFormData,
        }
      );

      const TelegramResponseSchema = z
        .object({
          ok: z.literal(true),
          result: z.object({
            document: z.object({
              file_id: z.string(),
            }),
          }),
        })
        .or(
          z.object({
            ok: z.literal(false),
            description: z.string().optional(),
          })
        );

      const rawResult = await tgResponse.json();
      const tgResult = TelegramResponseSchema.safeParse(rawResult);

      if (!tgResult.success || !tgResult.data.ok) {
        const errorDescription = (!tgResult.success) 
          ? 'Invalid API Response' 
          : (tgResult.data as { ok: false; description?: string }).description || 'Unknown Telegram Error';
        logError(rawResult, 'Error de Telegram API');
        throw new Error(`Telegram rechazó el archivo: ${errorDescription}`);
      }

      const fileId = tgResult.data.result.document.file_id;

      const chapterNumberMatch = file.name.match(/(\d+(\.\d+)?)/);
      if (!chapterNumberMatch)
        throw new Error('No se pudo extraer el número del capítulo del nombre del archivo');
      const chapterNumber = parseFloat(chapterNumberMatch[0]);

      let registeredChapterId: number;
      const existing = await db
        .select()
        .from(chapters)
        .where(and(eq(chapters.seriesId, seriesId), eq(chapters.chapterNumber, chapterNumber)))
        .get();

      if (!existing) {
        const insertResult = await db
          .insert(chapters)
          .values({
            seriesId,
            chapterNumber,
            telegramFileId: fileId,
            status: 'processing',
            urlPortada: `${env.R2_PUBLIC_URL_ASSETS}/covers/placeholder-chapter.jpg`,
            createdAt: new Date().toISOString(),
          })
          .returning({ id: chapters.id });

        if (!insertResult || insertResult.length === 0 || !insertResult[0]) {
          throw new Error('Error al registrar el capítulo en la base de datos');
        }
        registeredChapterId = insertResult[0]?.id;
      } else {
        await db
          .update(chapters)
          .set({
            telegramFileId: fileId,
            status: 'processing',
            createdAt: new Date().toISOString(),
          })
          .where(eq(chapters.id, existing.id));
        registeredChapterId = existing.id;
      }

      if (context.locals.runtime?.ctx) {
        context.locals.runtime.ctx.waitUntil(
          processAndCacheChapter(
            env,
            fileId,
            seriesData.slug,
            chapterNumber,
            registeredChapterId
          ).catch((err) => console.error('[Background Process Error]', err))
        );
      }

      return { success: true, chapterNumber, chapterId: registeredChapterId };
    },
  }),

  bulkCreatePlaceholders: defineAction({
    input: z.object({
      seriesId: z.number(),
      targetTotal: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { seriesId, targetTotal } = input;
      const db = getDB(context.locals.runtime.env);

      const seriesData = await db
        .select({ isAppSeries: series.isAppSeries })
        .from(series)
        .where(eq(series.id, seriesId))
        .get();
      if (!seriesData?.isAppSeries) throw new Error('Esta serie no es "Solo App"');

      const result = await db
        .select({ maxNum: max(chapters.chapterNumber) })
        .from(chapters)
        .where(eq(chapters.seriesId, seriesId))
        .get();
      const currentMax = result?.maxNum ?? 0;

      let addedCount = 0;
      const startNum = Math.floor(currentMax) + 1;

      for (let i = startNum; i <= targetTotal; i++) {
        try {
          await db
            .insert(chapters)
            .values({
              seriesId,
              chapterNumber: i,
              telegramFileId: `app_only_${seriesId}_${i}_${Math.random().toString(36).substring(2, 10)}`,
              status: 'app_only',
              views: 0,
            })
            .run();
          addedCount++;
        } catch {
          // Ignore duplicate errors during bulk placeholder creation
        }
      }

      return { success: true, added: addedCount };
    },
  }),

  update: defineAction({
    input: z.object({
      chapterId: z.number(),
      title: z.string().nullable(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { chapterId, title } = input;
      const db = getDB(context.locals.runtime.env);

      await db.update(chapters).set({ title }).where(eq(chapters.id, chapterId)).run();
      return { success: true };
    },
  }),

  uploadThumbnail: defineAction({
    accept: 'form',
    input: z.object({
      chapterId: z.string().transform((v) => parseInt(v, 10)),
      thumbnailImage: z.instanceof(File),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { chapterId, thumbnailImage } = input;
      const { env } = context.locals.runtime;
      const db = getDB(env);

      const thumbnailKey = `chapter-thumbnails/${chapterId}-${Date.now()}.${thumbnailImage.name.split('.').pop()}`;
      await env.R2_ASSETS.put(thumbnailKey, await thumbnailImage.arrayBuffer(), {
        httpMetadata: { contentType: thumbnailImage.type },
      });

      const thumbnailUrl = `${env.R2_PUBLIC_URL_ASSETS}/${thumbnailKey}`;
      await db
        .update(chapters)
        .set({ urlPortada: thumbnailUrl })
        .where(eq(chapters.id, chapterId))
        .run();

      return { success: true, thumbnailUrl };
    },
  }),
};
