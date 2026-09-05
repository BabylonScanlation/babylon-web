import { BlobReader, ZipReader } from '@zip.js/zip.js';
import { defineAction } from 'astro:actions';
import { env } from 'cloudflare:workers';
import { z } from 'astro/zod';
import { and, eq, isNull, max, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  chapters,
  chapterViews as chapterViewsTable,
  comments,
  episodeServers,
  pages,
  series,
} from '../db/schema';
import { canManageScanlation } from '../lib/auth-utils';
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
      const db = getDB(env);
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
      const ctx = context.locals.cfContext;
      const { user } = context.locals;
      const { cookies, request } = context;
      const clientAddress = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

      if (import.meta.env.DEV) {
        if (!ctx) console.warn('[chapter registerView] Warning: cfContext is missing');
      }

      const runBackgroundLogic = async () => {
        try {
          const kv = env.KV_VIEWS;
          const salt = env.INTERNAL_CRYPTO_SALT;

          if (!salt) {
            console.error('[chapter registerView] INTERNAL_CRYPTO_SALT is missing in env');
            return;
          }

          const ipHash = await hashIpAddress(clientAddress || '0.0.0.0', salt);
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

      const db = getDB(env);
      const { chapterIds } = input;

      if (!user) throw new Error('Unauthorized');

      const r2Cache = env.R2_CACHE;

      for (const id of chapterIds) {
        // Validación Multi-tenant por cada capítulo
        const chapterData = await db
          .select({ scanlationId: chapters.scanlationId })
          .from(chapters)
          .where(eq(chapters.id, id))
          .get();

        if (chapterData && !canManageScanlation(user, chapterData.scanlationId)) {
          console.warn(`[Forbidden] User ${user.uid} tried to delete chapter ${id}`);
          continue; // Saltamos este capítulo si no tiene permiso
        }

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
      scanlationId: z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
      language: z.string().default('es-la'),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      const { seriesId, file, scanlationId, language } = input;

      const db = getDB(env);

      if (!user) throw new Error('Unauthorized');

      // Validar internamente el contenido del ZIP/CBZ por seguridad
      try {
        const zipReader = new ZipReader(new BlobReader(file));
        const entries = await zipReader.getEntries();
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.xml', '.json', '.txt'];
        
        let hasImages = false;
        for (const entry of entries) {
          if (entry.directory) continue;
          
          const filenameLower = entry.filename.toLowerCase();
          const ext = filenameLower.includes('.') ? filenameLower.substring(filenameLower.lastIndexOf('.')) : '';
          
          if (!allowedExtensions.includes(ext)) {
            throw new Error(`Archivo peligroso o no permitido detectado dentro del comprimido: ${entry.filename}`);
          }
          
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) {
            hasImages = true;
          }
        }

        if (!hasImages) {
          throw new Error('El archivo comprimido está vacío o no contiene imágenes.');
        }
        await zipReader.close();
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('detectado dentro del comprimido')) {
          throw err;
        }
        if (err instanceof Error && err.message.includes('no contiene imágenes')) {
          throw err;
        }
        throw new Error('El archivo proporcionado no es un archivo ZIP o CBZ válido, o está corrupto. (Estructura inválida)');
      }

      // Validar si el usuario puede subir en nombre de este scanlation
      // Si no se envía scanlationId, el usuario debe ser Admin para subir "en nombre de la plataforma"
      if (scanlationId) {
        if (!canManageScanlation(user, scanlationId)) {
          throw new Error('No tienes permisos para subir capítulos en nombre de este Scanlation');
        }
      } else if (!user.isAdmin) {
        throw new Error('Debes seleccionar un Scanlation para subir capítulos');
      }

      const seriesData = await db
        .select({
          topicId: series.telegramTopicId,
          slug: series.slug,
        })
        .from(series)
        .where(eq(series.id, seriesId))
        .get();

      if (!seriesData) throw new Error('Serie no encontrada');

      // Obtener datos del Scanlation para Telegram
      let targetChatId = env.TELEGRAM_CHAT_ID || null;
      if (scanlationId) {
        const scanData = await db
          .select({ telegramChatId: schema.scanlations.telegramChatId })
          .from(schema.scanlations)
          .where(eq(schema.scanlations.id, scanlationId))
          .get();
        if (scanData?.telegramChatId) {
          targetChatId = scanData.telegramChatId;
        }
      }

      if (!targetChatId) {
        throw new Error(
          'Configuración de Telegram (Chat ID) faltante para este Scanlation o Global.'
        );
      }

      const tgFormData = new FormData();
      tgFormData.append('chat_id', targetChatId);

      if (seriesData.topicId) {
        tgFormData.append('message_thread_id', seriesData.topicId.toString());
      }

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
        const errorDescription = !tgResult.success
          ? 'Invalid API Response'
          : (tgResult.data as { ok: false; description?: string }).description ||
            'Unknown Telegram Error';
        logError(rawResult, 'Error de Telegram API');
        throw new Error(`Telegram rechazó el archivo: ${errorDescription}`);
      }

      const fileId = tgResult.data.result.document.file_id;

      const chapterNumberMatch = file.name.match(/(\d+(\.\d+)?)/);
      if (!chapterNumberMatch)
        throw new Error('No se pudo extraer el número del capítulo del nombre del archivo');
      const chapterNumber = parseFloat(chapterNumberMatch[0]);

      const isNsfw = /nsfw/i.test(file.name);

      let registeredChapterId: number;
      const existing = await db
        .select()
        .from(chapters)
        .where(
          and(
            eq(chapters.seriesId, seriesId),
            eq(chapters.chapterNumber, chapterNumber),
            scanlationId ? eq(chapters.scanlationId, scanlationId) : isNull(chapters.scanlationId),
            eq(chapters.language, language),
            eq(chapters.isNsfw, isNsfw)
          )
        )
        .get();

      if (!existing) {
        const insertResult = await db
          .insert(chapters)
          .values({
            seriesId,
            chapterNumber,
            telegramFileId: fileId,
            scanlationId: scanlationId || null,
            uploaderId: user.uid,
            language,
            isNsfw,
            status: 'processing',
            urlPortada: `${env.R2_PUBLIC_URL_ASSETS}/covers/comic/placeholder-chapter.jpg`,
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
            uploaderId: user.uid,
            createdAt: new Date().toISOString(),
          })
          .where(eq(chapters.id, existing.id));
        registeredChapterId = existing.id;
      }

      if (context.locals.cfContext) {
        const { processAndCacheChapter } = await import('../lib/chapterProcessing');
        context.locals.cfContext.waitUntil(
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
      scanlationId: z.number().optional(),
      language: z.string().default('es-la'),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { seriesId, targetTotal, scanlationId, language } = input;
      const db = getDB(env);

      const seriesData = await db
        .select({ isAppSeries: series.isAppSeries })
        .from(series)
        .where(eq(series.id, seriesId))
        .get();
      if (!seriesData?.isAppSeries) throw new Error('Esta serie no es "Solo App"');

      const result = await db
        .select({ maxNum: max(chapters.chapterNumber) })
        .from(chapters)
        .where(
          and(
            eq(chapters.seriesId, seriesId),
            scanlationId ? eq(chapters.scanlationId, scanlationId) : isNull(chapters.scanlationId),
            eq(chapters.language, language)
          )
        )
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
              scanlationId: scanlationId || null,
              uploaderId: user.uid,
              language,
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
      const { chapterId, title } = input;
      const db = getDB(env);

      // Obtener scanlationId directamente del capítulo
      const chapterData = await db
        .select({ scanlationId: chapters.scanlationId })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .get();

      if (!chapterData) throw new Error('Capítulo no encontrado');
      if (!canManageScanlation(user, chapterData.scanlationId)) {
        throw new Error('Forbidden');
      }

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
      const { chapterId, thumbnailImage } = input;

      const db = getDB(env);

      // Obtener scanlationId directamente del capítulo
      const chapterData = await db
        .select({ scanlationId: chapters.scanlationId })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .get();

      if (!chapterData) throw new Error('Capítulo no encontrado');
      if (!canManageScanlation(user, chapterData.scanlationId)) {
        throw new Error('Forbidden');
      }

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

  toggleNsfw: defineAction({
    input: z.object({
      chapterId: z.number(),
      isNsfw: z.boolean(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      const { chapterId, isNsfw } = input;
      const db = getDB(env);

      const chapterData = await db
        .select({ scanlationId: chapters.scanlationId })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .get();

      if (!chapterData) throw new Error('Capítulo no encontrado');
      if (!canManageScanlation(user, chapterData.scanlationId)) {
        throw new Error('Forbidden');
      }

      await db.update(chapters).set({ isNsfw }).where(eq(chapters.id, chapterId)).run();
      return { success: true };
    },
  }),

  addAnimeEpisode: defineAction({
    accept: 'form',
    input: z.object({
      seriesId: z.string().transform((v) => parseInt(v, 10)),
      chapterNumber: z.string().transform((v) => parseFloat(v)),
      language: z.string().default('es-la'),
      title: z.string().optional(),
      servers: z.string(), // JSON string: [{ serverName: 'Mega', iframeUrl: '...' }]
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      const { seriesId, chapterNumber, language, title, servers } = input;

      const db = getDB(env);

      if (!user) throw new Error('Unauthorized');
      if (!user.isAdmin) {
        throw new Error('Solo administradores pueden añadir episodios de anime por ahora');
      }

      const seriesData = await db
        .select({ id: series.id, slug: series.slug, type: series.type })
        .from(series)
        .where(eq(series.id, seriesId))
        .get();

      if (!seriesData) throw new Error('Serie no encontrada');
      if (seriesData.type !== 'anime' && seriesData.type !== 'ova' && seriesData.type !== 'movie') {
        throw new Error('Esta serie no es un anime');
      }

      let parsedServersArray: {
        serverName: string;
        iframeUrl: string;
        language?: string;
        isDirectVideo?: boolean;
      }[];
      try {
        parsedServersArray = JSON.parse(servers);
      } catch (err: unknown) {
        throw new Error('Formato de servidores inválido', { cause: err });
      }

      if (!parsedServersArray || parsedServersArray.length === 0) {
        throw new Error('Debes proveer al menos un servidor');
      }

      // Check if episode already exists
      const existing = await db
        .select()
        .from(chapters)
        .where(
          and(
            eq(chapters.seriesId, seriesId),
            eq(chapters.chapterNumber, chapterNumber),
            eq(chapters.language, language)
          )
        )
        .get();

      let chapterId = existing?.id;

      if (!existing) {
        const insertResult = await db
          .insert(chapters)
          .values({
            seriesId,
            chapterNumber,
            title: title || `Episodio ${chapterNumber}`,
            uploaderId: user.uid,
            language,
            isNsfw: false,
            status: 'live', // Episodes are immediately live since they don't need Telegram processing
            urlPortada: `${env.R2_PUBLIC_URL_ASSETS}/covers/comic/placeholder-chapter.jpg`,
            createdAt: new Date().toISOString(),
          })
          .returning({ id: chapters.id });

        if (!insertResult || insertResult.length === 0 || !insertResult[0]) {
          throw new Error('Error al registrar el episodio en la base de datos');
        }
        chapterId = insertResult[0].id;
      } else {
        if (!chapterId) throw new Error('ID de capítulo no disponible para actualizar');
        await db
          .update(chapters)
          .set({ title: title || existing.title })
          .where(eq(chapters.id, chapterId))
          .run();

        // Delete old servers to replace them
        await db.delete(episodeServers).where(eq(episodeServers.chapterId, chapterId)).run();
      }

      if (!chapterId) throw new Error('ID de capítulo no disponible para insertar servidores');

      // Insert servers
      for (let i = 0; i < parsedServersArray.length; i++) {
        const s = parsedServersArray[i];
        if (!s?.serverName || !s.iframeUrl) continue;

        await db
          .insert(episodeServers)
          .values({
            chapterId: chapterId,
            serverName: s.serverName,
            iframeUrl: s.iframeUrl,
            language: s.language || language,
            displayOrder: i,
            isDirectVideo: s.isDirectVideo || false,
          })
          .run();
      }

      return { success: true, chapterNumber, chapterId };
    },
  }),
};
