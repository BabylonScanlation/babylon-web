import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  addNewsImage,
  createNews,
  deleteNews,
  getDB,
  getNewsImages,
  type NewsImageItem,
  updateNews,
} from '../lib/db';

export const newsActions = {
  uploadImage: defineAction({
    accept: 'form',
    input: z.object({
      image: z.instanceof(File),
      newsId: z.string(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { image, newsId } = input;
      console.log(`[R2 Upload] Starting upload for news ${newsId}, file: ${image.name} (${image.size} bytes)`);
      
      const r2Assets = context.locals.runtime.env.R2_ASSETS;
      const db = getDB(context.locals.runtime.env);

      if (!r2Assets) {
        console.error('[R2 Upload] Error: R2_ASSETS binding is missing');
        throw new Error('R2 storage not configured');
      }

      const arrayBuffer = await image.arrayBuffer();
      const cleanName = image.name.replace(/[^a-zA-Z0-9.]/g, '_');
      
      // Orion: Determinamos la carpeta y usamos un prefijo para evitar subcarpetas nuevas
      const newsItem = await db.select({ seriesId: schema.news.seriesId }).from(schema.news).where(eq(schema.news.id, newsId)).get();
      const isGlobal = !newsItem || newsItem.seriesId === null;
      
      // Estructura plana: news/[global_news/]ID_filename
      const r2Key = isGlobal 
        ? `news/global_news/${newsId}_${cleanName}` 
        : `news/${newsId}_${cleanName}`;

      try {
        await r2Assets.put(r2Key, arrayBuffer, {
          httpMetadata: { contentType: image.type },
        });
        console.log(`[R2 Upload] Success: ${r2Key}`);
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
      seriesId: z.number().nullable(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);

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

      const newNews = await createNews(db, {
        ...input,
        publishedBy: user.uid,
        authorName,
      });

      return { ...newNews, authorAvatar: dbUser?.avatarUrl };
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
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { id, ...updates } = input;
      const db = getDB(context.locals.runtime.env);

      const updatedNews = await updateNews(db, id, updates);
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
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { id } = input;
      const db = getDB(context.locals.runtime.env);
      const r2Assets = context.locals.runtime.env.R2_ASSETS;

      const images = await getNewsImages(db, id);
      if (images && images.length > 0) {
        const keys = images.map((img: NewsImageItem) => img.r2Key);
        await r2Assets.delete(keys);
      }

      await deleteNews(db, id);
      return { success: true, id };
    },
  }),
};
