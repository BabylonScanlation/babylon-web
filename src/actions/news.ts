import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  addNewsImage,
  createNews,
  deleteNews,
  getNewsImages,
  type NewsImageItem,
  updateNews,
} from '../lib/data/news';
import { canManageScanlation, isScanlationMember } from '../lib/auth-utils';
import { getDB } from '../lib/db';
import { censorText } from '../lib/profanity';

/**
 * Orion: Validador de propiedad de noticia para Multi-tenancy.
 */
async function validateNewsOwnership(db: any, user: any, newsId: string) {
  const existing = await db
    .select({ seriesId: schema.news.seriesId, scanlationId: schema.news.scanlationId })
    .from(schema.news)
    .where(eq(schema.news.id, newsId))
    .get();

  if (!existing) throw new Error('Noticia no encontrada');

  // Si la noticia es GLOBAL (no vinculada a serie)
  if (existing.seriesId === null) {
    if (existing.scanlationId === null) {
      // Es una noticia GLOBAL TOTAL (solo admins)
      if (!user?.isAdmin)
        throw new Error(
          'Solo los administradores globales pueden gestionar noticias globales totales'
        );
    } else {
      // Es una noticia GLOBAL de un SCANLATION
      if (!canManageScanlation(user, existing.scanlationId)) {
        throw new Error('No tienes permiso para gestionar noticias de este scanlation');
      }
    }
    return;
  }

  // Si la noticia es de una SERIE, verificar si el usuario pertenece al scanlation dueño de esa serie
  const seriesData = await db
    .select({ scanlationId: schema.series.scanlationId })
    .from(schema.series)
    .where(eq(schema.series.id, existing.seriesId))
    .get();

  if (!canManageScanlation(user, seriesData?.scanlationId)) {
    throw new Error('No tienes permiso para gestionar noticias de esta serie');
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
      const db = getDB(context.locals.runtime.env);

      // Orion: Seguridad Multi-tenant
      await validateNewsOwnership(db, user, newsId);

      console.log(
        `[R2 Upload] Starting upload for news ${newsId}, file: ${image.name} (${image.size} bytes)`
      );

      const r2Assets = context.locals.runtime.env.R2_ASSETS;
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
        throw new Error('Failed to upload to storage');
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
      id: z.string().uuid().optional(),
      title: z.string().min(1, 'El título es obligatorio'),
      content: z.string().min(1, 'El contenido es obligatorio'),
      status: z.enum(['draft', 'published']).default('published'),
      seriesId: z.any(), // Aceptamos any para manejar la conversión manual y evitar 500s de Zod
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user || !isScanlationMember(user)) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);

      // Normalización de seriesId (Astra: Los formularios a veces envían strings o tipos inesperados)
      let seriesId: number | null = null;
      const rawId = input.seriesId;

      if (rawId !== null && rawId !== undefined && rawId !== 'null' && rawId !== '') {
        seriesId = Number.parseInt(String(rawId), 10);
        if (Number.isNaN(seriesId)) seriesId = null;
      }

      try {
        // Orion: Lógica de propiedad (Multi-tenant)
        let targetScanlationId: number | null = null;

        if (seriesId === null || isNaN(seriesId)) {
          // Es una noticia GLOBAL
          if (user?.isAdmin) {
            // Admin global: noticia total (scanlationId null)
            targetScanlationId = null;
          } else if (isScanlationMember(user)) {
            // Miembro scanlation: noticia global del grupo
            targetScanlationId = user.scanlations?.[0]?.id || null;
          } else {
            throw new Error(
              'Solo los administradores o miembros de scanlation pueden crear noticias.'
            );
          }
        } else {
          // Es una noticia vinculada a una SERIE
          const seriesData = await db
            .select({ scanlationId: schema.series.scanlationId })
            .from(schema.series)
            .where(eq(schema.series.id, seriesId))
            .get();

          if (!seriesData) throw new Error('La obra seleccionada no existe en la base de datos.');

          if (!canManageScanlation(user, seriesData.scanlationId)) {
            throw new Error('No tienes permiso para publicar noticias en esta serie.');
          }
          targetScanlationId = seriesData.scanlationId;
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

        await context.locals.runtime.env.KV_VIEWS?.delete('news_count_cache');

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
      } catch (e: any) {
        console.error('[News Create Error]', e);
        throw new Error(e.message || 'Error interno al crear la noticia');
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
      const db = getDB(context.locals.runtime.env);

      // Orion: Validación de propiedad (Multi-tenant)
      await validateNewsOwnership(db, user, id);

      await context.locals.runtime.env.KV_VIEWS?.delete('news_count_cache');

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
      const db = getDB(context.locals.runtime.env);
      const r2Assets = context.locals.runtime.env.R2_ASSETS;

      // Orion: Validación de propiedad (Multi-tenant)
      await validateNewsOwnership(db, user, id);

      await context.locals.runtime.env.KV_VIEWS?.delete('news_count_cache');

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
      const db = getDB(context.locals.runtime.env);

      // Orion: Validación de propiedad (Multi-tenant)
      await validateNewsOwnership(db, user, id);

      await context.locals.runtime.env.KV_VIEWS?.delete('news_count_cache');

      const updatedNews = await updateNews(db, id, { status: newStatus });
      if (!updatedNews) throw new Error('Noticia no encontrada');

      return updatedNews;
    },
  }),
};
