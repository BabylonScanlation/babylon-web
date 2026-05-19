import { defineAction } from 'astro:actions';
import { env } from 'cloudflare:workers';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { canManageScanlation, isScanlationMember } from '../lib/auth-utils';
import {
  addNewsImage,
  createNews,
  deleteNews,
  getNewsImages,
  type NewsImageItem,
  updateNews,
} from '../lib/data/news';
import { getDB } from '../lib/db';
import { censorText } from '../lib/profanity';
import type { User } from '../types';

/**
 * Orion: Validador de propiedad de noticia para Multi-tenancy.
 */
async function validateNewsOwnership(
  db: DrizzleD1Database<typeof schema>,
  user: User,
  newsId: string
) {
  const existing = await db
    .select({ scanlationId: schema.news.scanlationId })
    .from(schema.news)
    .where(eq(schema.news.id, newsId))
    .get();

  if (!existing) throw new Error('Noticia no encontrada');

  if (existing.scanlationId === null) {
    // Es una noticia GLOBAL TOTAL (solo admins)
    if (!user?.isAdmin)
      throw new Error(
        'Solo los administradores globales pueden gestionar noticias globales totales'
      );
  } else {
    // Es una noticia de un SCANLATION
    if (!canManageScanlation(user, existing.scanlationId)) {
      throw new Error('No tienes permiso para gestionar noticias de este scanlation');
    }
  }
}

export const newsActions = {
  uploadImage: defineAction({
    accept: 'form',
    input: z.object({
      image: z.instanceof(File),
      newsId: z.string(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user || !isScanlationMember(user)) throw new Error('Unauthorized');

      const { image, newsId } = input;
      const db = getDB(env);

      // Orion: Seguridad Multi-tenant
      await validateNewsOwnership(db, user, newsId);

      console.log(
        `[R2 Upload] Starting upload for news ${newsId}, file: ${image.name} (${image.size} bytes)`
      );

      const r2Assets = env.R2_ASSETS;
      if (!r2Assets) {
        console.error('[R2 Upload] Error: R2_ASSETS binding is missing');
        throw new Error('R2 storage not configured');
      }

      const arrayBuffer = await image.arrayBuffer();
      const cleanName = image.name.replace(/[^a-zA-Z0-9.]/g, '_');

      const newsItem = await db
        .select({ seriesId: schema.news.seriesId })
        .from(schema.news)
        .where(eq(schema.news.id, newsId))
        .get();
      const isGlobal = !newsItem || newsItem.seriesId === null;

      const r2Key = isGlobal
        ? `news/global_news/${newsId}_${cleanName}`
        : `news/${newsId}_${cleanName}`;

      try {
        await r2Assets.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: image.type },
        });
      } catch (err) {
        console.error(`[R2 Upload] Failed to put object ${r2Key}:`, err);
        throw new Error('Failed to upload to storage', { cause: err });
      }

      await addNewsImage(db, {
        newsId,
        r2Key,
        altText: `Image for news ${newsId}`,
        displayOrder: 0,
      });

      return { r2Key };
    },
  }),

  create: defineAction({
    input: z.object({
      id: z.uuid().optional(),
      title: z.string().min(1, 'El título es obligatorio'),
      content: z.string().min(1, 'El contenido es obligatorio'),
      status: z.enum(['draft', 'published']).default('published'),
      seriesId: z.any(), // Aceptamos any para manejar la conversión manual
      scanlationId: z
        .string()
        .transform((v) => parseInt(v, 10))
        .optional(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user || !isScanlationMember(user)) throw new Error('Unauthorized');

      const db = getDB(env);

      // Normalización de seriesId
      let seriesId: number | null = null;
      const rawId = input.seriesId;

      if (rawId !== null && rawId !== undefined && rawId !== 'null' && rawId !== '') {
        seriesId = Number.parseInt(String(rawId), 10);
        if (Number.isNaN(seriesId)) seriesId = null;
      }

      try {
        // Orion: Lógica de propiedad (Multi-tenant)
        let targetScanlationId: number | null = null;

        if (input.scanlationId) {
          // El usuario especifica el scanlation
          if (!canManageScanlation(user, input.scanlationId)) {
            throw new Error(
              'No tienes permiso para publicar noticias en nombre de este Scanlation'
            );
          }
          targetScanlationId = input.scanlationId;
        } else if (user?.isAdmin) {
          // Admin global: noticia total si no elige scanlation
          targetScanlationId = null;
        } else {
          // Usuario normal: usar su primer scanlation por defecto
          targetScanlationId = user.scanlations?.[0]?.id || null;
          if (!targetScanlationId) {
            throw new Error('Debes pertenecer a un Scanlation para crear noticias');
          }
        }

        if (seriesId !== null) {
          const seriesExists = await db
            .select({ id: schema.series.id })
            .from(schema.series)
            .where(eq(schema.series.id, seriesId))
            .get();
          if (!seriesExists) throw new Error('La obra seleccionada no existe');
        }

        const dbUser = await db
          .select({
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatarUrl: schema.users.avatarUrl,
          })
          .from(schema.users)
          .where(eq(schema.users.id, user.uid))
          .get();

        const authorName = dbUser?.username || dbUser?.displayName || 'Admin';

        await env.KV_VIEWS?.delete('news_count_cache');

        const newNews = await createNews(db, {
          ...input,
          seriesId, // Usamos el ID normalizado
          scanlationId: targetScanlationId, // Vinculamos al scanlation
          title: censorText(input.title),
          content: censorText(input.content),
          publishedBy: user.uid,
          authorName,
        });

        // Orion: Obtener nombre del scan para el badge inmediato
        let scanName = null;
        if (targetScanlationId) {
          const scan = await db
            .select({ name: schema.scanlations.name })
            .from(schema.scanlations)
            .where(eq(schema.scanlations.id, targetScanlationId))
            .get();
          scanName = scan?.name || null;
        }

        return {
          ...newNews,
          authorAvatar: dbUser?.avatarUrl,
          scanName,
          isAdminPost: !!user.isAdmin,
        };
      } catch (e: unknown) {
        console.error('[News Create Error]', e);
        throw new Error(e instanceof Error ? e.message : 'Error interno al crear la noticia', {
          cause: e,
        });
      }
    },
  }),

  update: defineAction({
    input: z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      status: z.enum(['draft', 'published']).optional(),
      seriesId: z.number().nullable().optional(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user || !isScanlationMember(user)) throw new Error('Unauthorized');

      const { id, ...updates } = input;
      const db = getDB(env);

      // Orion: Validación de propiedad (Multi-tenant)
      await validateNewsOwnership(db, user, id);

      await env.KV_VIEWS?.delete('news_count_cache');

      const updatedNews = await updateNews(db, id, {
        ...updates,
        title: updates.title ? censorText(updates.title) : undefined,
        content: updates.content ? censorText(updates.content) : undefined,
      });
      if (!updatedNews) throw new Error('Noticia no encontrada');

      return updatedNews;
    },
  }),

  delete: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user || !isScanlationMember(user)) throw new Error('Unauthorized');

      const { id } = input;
      const db = getDB(env);
      const r2Assets = env.R2_ASSETS;

      // Orion: Validación de propiedad (Multi-tenant)
      await validateNewsOwnership(db, user, id);

      await env.KV_VIEWS?.delete('news_count_cache');

      const images = await getNewsImages(db, id);
      if (images && images.length > 0) {
        const keys = images.map((img: NewsImageItem) => img.r2Key);
        await r2Assets.delete(keys);
      }

      await deleteNews(db, id);
      return { success: true, id };
    },
  }),

  toggleStatus: defineAction({
    input: z.object({
      id: z.string(),
      currentStatus: z.enum(['draft', 'published']),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user || !isScanlationMember(user)) throw new Error('Unauthorized');

      const { id, currentStatus } = input;
      const newStatus = currentStatus === 'draft' ? 'published' : 'draft';
      const db = getDB(env);

      // Orion: Validación de propiedad (Multi-tenant)
      await validateNewsOwnership(db, user, id);

      await env.KV_VIEWS?.delete('news_count_cache');

      const updatedNews = await updateNews(db, id, { status: newStatus });
      if (!updatedNews) throw new Error('Noticia no encontrada');

      return updatedNews;
    },
  }),
};
