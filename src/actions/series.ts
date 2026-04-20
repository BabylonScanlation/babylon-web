import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { chapters, series } from '../db/schema';
import { canManageScanlation, isScanlationMember } from '../lib/auth-utils';
import { hashIpAddress } from '../lib/crypto';
import { getDB } from '../lib/db';
import { logError } from '../lib/logError';
import { siteConfig } from '../site.config';

async function clearSeriesR2Data(
  slug: string | null,
  cover: string | null,
  env: {
    R2_CACHE: {
      get: (...args: unknown[]) => unknown;
      put: (...args: unknown[]) => unknown;
      delete: (...args: unknown[]) => unknown;
      list: (...args: unknown[]) => unknown;
    };
    R2_ASSETS: {
      get: (...args: unknown[]) => unknown;
      put: (...args: unknown[]) => unknown;
      delete: (...args: unknown[]) => unknown;
      list: (...args: unknown[]) => unknown;
    };
  }
) {
  const { R2_CACHE: r2Cache, R2_ASSETS: r2Assets } = env;

  if (slug) {
    let truncated = true;
    let cursor: string | undefined;
    while (truncated) {
      const list = (await r2Cache.list({ prefix: `${slug}/`, cursor })) as {
        objects: { key: string }[];
        truncated: boolean;
        cursor?: string;
      };
      const keys = list.objects.map((obj) => obj.key);
      if (keys.length > 0) await r2Cache.delete(keys);
      truncated = list.truncated;
      cursor = list.truncated ? list.cursor : undefined;
    }
  }

  if (cover && !cover.includes('placeholder')) {
    await r2Assets.delete(cover);
  }
}

export const seriesActions = {
  create: defineAction({
    accept: 'form',
    input: z.object({
      title: z.string().min(1, 'El título es obligatorio'),
      slug: z.string().min(1, 'El slug es obligatorio'),
      description: z.string().optional(),
      coverImage: z.instanceof(File).optional(),
      coverImageUrl: z.string().optional(),
      status: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      genres: z.string().nullable().optional(),
      author: z.string().nullable().optional(),
      artist: z.string().nullable().optional(),
      demographic: z.string().nullable().optional(),
      publishedBy: z.string().nullable().optional(),
      alternativeNames: z.string().nullable().optional(),
      serializedBy: z.string().nullable().optional(),
      isAppSeries: z
        .boolean()
        .or(z.string().transform((v) => v === 'true'))
        .optional(),
      isHidden: z
        .boolean()
        .or(z.string().transform((v) => v === 'true'))
        .optional(),
      isNsfw: z
        .boolean()
        .or(z.string().transform((v) => v === 'true'))
        .optional(),
      scanlationId: z
        .number()
        .or(z.string().transform((v) => parseInt(v, 10)))
        .optional(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!isScanlationMember(user)) throw new Error('Unauthorized');

      const { env } = context.locals.runtime;
      const db = getDB(env);

      // Si no es admin global, forzamos el scanlationId a uno del usuario
      let targetScanlationId = input.scanlationId;
      if (!user?.isAdmin) {
        const userScans = user?.scanlations?.map((s) => s.id) || [];
        if (targetScanlationId && !userScans.includes(targetScanlationId)) {
          throw new Error('Forbidden: No perteneces a este scanlation');
        }
        if (!targetScanlationId) {
          targetScanlationId = userScans[0]; // Por defecto el primero
        }
      }

      const { title, coverImage } = input;
      let { slug, coverImageUrl } = input;

      slug = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      if (coverImage instanceof File && coverImage.size > 0) {
        const fileExt = coverImage.name.split('.').pop() || 'jpg';
        const folder = siteConfig.folders.covers;
        const fileName = `${folder}/${slug}-${Date.now()}.${fileExt}`;

        await env.R2_ASSETS.put(fileName, await coverImage.arrayBuffer(), {
          httpMetadata: { contentType: coverImage.type },
        });

        coverImageUrl = fileName;
      } else if (!coverImageUrl) {
        coverImageUrl = siteConfig.assets.placeholderCover.replace(/^\//, '');
      }

      // Orion: Determinar el canal de Telegram (Separación Profiláctica Estricta)
      let targetChatId: string | null = null;

      if (targetScanlationId) {
        const scanData = await db
          .select({ telegramChatId: schema.scanlations.telegramChatId })
          .from(schema.scanlations)
          .where(eq(schema.scanlations.id, targetScanlationId))
          .get();

        if (!scanData?.telegramChatId) {
          throw new Error(
            'Este Scanlation no tiene un canal de Telegram configurado por la administración. No se puede crear la serie.'
          );
        }
        targetChatId = scanData.telegramChatId;
      } else {
        // Es una serie Global/Admin
        targetChatId = env.TELEGRAM_CHAT_ID || null;
      }

      const botToken = env.TELEGRAM_BOT_TOKEN;

      if (!targetChatId || !botToken) {
        throw new Error('Configuración de Telegram faltante en el servidor');
      }

      const telegramUrl = `https://api.telegram.org/bot${botToken}/createForumTopic`;
      const tgResponse = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          name: title,
        }),
      });

      interface TelegramForumTopicResponse {
        ok: boolean;
        description?: string;
        result: {
          message_thread_id: number;
        };
      }

      const tgData = (await tgResponse.json()) as TelegramForumTopicResponse;

      if (!tgResponse.ok || !tgData.ok) {
        logError(tgData, 'Error al crear el topic en Telegram');
        throw new Error(`Error en Telegram: ${tgData.description}`);
      }

      const telegramTopicId = tgData.result.message_thread_id;

      // Orion: Invalidamos el caché de la Home en KV para reflejar la nueva serie
      const kv = env.KV_VIEWS;
      if (kv) {
        await Promise.all([
          kv.delete('home_data_nsfw_true'),
          kv.delete('home_data_nsfw_false'),
        ]).catch(() => {});
      }

      await db.insert(series).values({
        ...input,
        slug,
        coverImageUrl,
        telegramTopicId,
        scanlationId: targetScanlationId,
        isAppSeries: !!input.isAppSeries,
        isHidden: !!input.isHidden,
        isNsfw: !!input.isNsfw,
        createdAt: new Date().toISOString(),
      });

      return { success: true, slug, telegramTopicId };
    },
  }),

  update: defineAction({
    accept: 'form',
    input: z.object({
      seriesId: z.string().transform((v) => parseInt(v, 10)),
      title: z.string().min(1),
      description: z.string().min(1),
      slug: z.string().optional(),
      coverImage: z.instanceof(File).optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      genres: z.string().optional(),
      author: z.string().optional(),
      artist: z.string().optional(),
      publishedBy: z.string().optional(),
      alternativeNames: z.string().optional(),
      serializedBy: z.string().optional(),
      demographic: z.string().optional(),
      isHidden: z
        .string()
        .transform((v) => v === 'on')
        .optional(),
      isAppSeries: z
        .string()
        .transform((v) => v === 'on')
        .optional(),
      isNsfw: z
        .string()
        .transform((v) => v === 'on')
        .optional(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      const { env } = context.locals.runtime;
      const db = getDB(env);
      const { seriesId, coverImage } = input;

      const currentSeries = await db.select().from(series).where(eq(series.id, seriesId)).get();
      if (!currentSeries) throw new Error('Serie no encontrada');

      // Validar propiedad (Multi-tenant)
      if (!canManageScanlation(user, currentSeries.scanlationId)) {
        throw new Error('Forbidden: No tienes permiso para editar esta serie');
      }

      let slug = input.slug || currentSeries.slug;
      if (slug !== currentSeries.slug || slug.startsWith('serie-')) {
        slug = slug
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      let coverImageUrl = currentSeries.coverImageUrl;
      if (coverImage instanceof File && coverImage.size > 0) {
        const imageExtension = coverImage.name.split('.').pop() || 'jpg';
        const imageKey = `covers/${slug}.${Date.now()}.${imageExtension}`;
        await env.R2_ASSETS.put(imageKey, await coverImage.arrayBuffer(), {
          httpMetadata: { contentType: coverImage.type },
        });
        coverImageUrl = imageKey;
      }

      // Orion: Invalidamos el caché de la Home en KV
      const kv = env.KV_VIEWS;
      if (kv) {
        await Promise.all([
          kv.delete('home_data_nsfw_true'),
          kv.delete('home_data_nsfw_false'),
        ]).catch(() => {});
      }

      await db
        .update(series)
        .set({
          title: input.title,
          description: input.description,
          status: input.status,
          type: input.type,
          author: input.author,
          artist: input.artist,
          slug,
          coverImageUrl,
          isHidden: !!input.isHidden,
          isAppSeries: !!input.isAppSeries,
          isNsfw: !!input.isNsfw,
        })
        .where(eq(series.id, seriesId))
        .run();

      return { success: true, slug };
    },
  }),

  delete: defineAction({
    input: z.object({
      seriesId: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      const { env } = context.locals.runtime;
      const db = getDB(env);
      const { seriesId } = input;

      const seriesData = await db.select().from(series).where(eq(series.id, seriesId)).get();
      if (!seriesData) throw new Error('Serie no encontrada');

      // Orion: Validación Multi-tenant
      if (!canManageScanlation(user, seriesData.scanlationId)) {
        throw new Error('Forbidden: No tienes permiso para borrar esta serie');
      }

      // Limpieza de R2 (Capítulos y Portada)
      await clearSeriesR2Data(seriesData.slug, seriesData.coverImageUrl, env);

      // Orion: Invalidamos el caché de la Home en KV
      const kv = env.KV_VIEWS;
      if (kv) {
        await Promise.all([
          kv.delete('home_data_nsfw_true'),
          kv.delete('home_data_nsfw_false'),
        ]).catch(() => {});
      }

      await db.delete(chapters).where(eq(chapters.seriesId, seriesId)).run();
      await db.delete(series).where(eq(series.id, seriesId)).run();

      return { success: true };
    },
  }),

  react: defineAction({
    input: z.object({
      seriesId: z.number(),
      emoji: z.string().nullable(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { seriesId, emoji } = input;
      const db = getDB(context.locals.runtime.env);
      const { seriesReactions } = await import('../db/schema');

      if (!emoji) {
        await db
          .delete(seriesReactions)
          .where(and(eq(seriesReactions.userId, user.uid), eq(seriesReactions.seriesId, seriesId)))
          .run();
      } else {
        await db
          .insert(seriesReactions)
          .values({
            userId: user.uid,
            seriesId,
            reactionEmoji: emoji,
          })
          .onConflictDoUpdate({
            target: [seriesReactions.userId, seriesReactions.seriesId],
            set: { reactionEmoji: emoji },
          })
          .run();
      }

      return { success: true };
    },
  }),

  registerView: defineAction({
    input: z.object({
      seriesId: z.number(),
    }),
    handler: async (input, context) => {
      const { seriesId } = input;
      const { env, ctx } = context.locals.runtime;
      const clientAddress = context.clientAddress;

      const runViewLogic = async () => {
        try {
          const kv = env.KV_VIEWS;
          const ipHash = await hashIpAddress(clientAddress || '0.0.0.0', env.INTERNAL_CRYPTO_SALT);
          const viewKey = `v:s:${seriesId}:${ipHash}`;

          if (kv) {
            const alreadyViewed = await kv.get(viewKey);
            if (alreadyViewed) return;
            await kv.put(viewKey, '1', { expirationTtl: 86400 });
          }

          const db = getDB(env);
          const { seriesViews } = await import('../db/schema');
          await db
            .insert(seriesViews)
            .values({
              seriesId,
              ipAddress: ipHash,
              viewedAt: sql`CURRENT_TIMESTAMP`,
            })
            .onConflictDoNothing()
            .run();
        } catch (err) {
          console.error('[Action registerView Error]', err);
        }
      };

      if (ctx?.waitUntil) ctx.waitUntil(runViewLogic());
      else runViewLogic();

      return { success: true };
    },
  }),

  toggleMetadata: defineAction({
    input: z.object({
      seriesId: z.number(),
      key: z.enum(['isHidden', 'isNsfw', 'isAppSeries']),
      value: z.boolean(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      const { seriesId, key, value } = input;
      const db = getDB(context.locals.runtime.env);

      const currentSeries = await db
        .select({ scanlationId: series.scanlationId })
        .from(series)
        .where(eq(series.id, seriesId))
        .get();
      if (!currentSeries) throw new Error('Serie no encontrada');

      if (!canManageScanlation(user, currentSeries.scanlationId)) {
        throw new Error('Forbidden');
      }

      await db
        .update(series)
        .set({ [key]: value })
        .where(eq(series.id, seriesId))
        .run();
      return { success: true };
    },
  }),
};
