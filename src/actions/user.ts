import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { favorites, series, seriesRatings, userProgress, users } from '../db/schema';
import { getDB } from '../lib/db';
import { consumeNonce } from '../lib/nonce';
import { generateRandomUsername } from '../lib/utils';

const ProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  bio: z.string().max(160).optional(),
  website: z.string().url().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
  isNsfw: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  nonce: z.string().optional(),
});

export const userActions = {
  getContinueReading: defineAction({
    handler: async (_, context) => {
      const { user } = context.locals;
      if (!user) return [];
      const db = getDB(context.locals.runtime.env);
      return await db
        .select({
          series: {
            id: series.id,
            title: series.title,
            slug: series.slug,
            coverImageUrl: series.coverImageUrl,
            views: series.views,
          },
          nextChapter: {
            number: userProgress.chapterNumber,
            url: sql<string>`'/series/' || ${series.slug} || '/' || ${userProgress.chapterNumber}`,
            createdAt: userProgress.lastReadAt,
          },
        })
        .from(userProgress)
        .innerJoin(series, eq(userProgress.seriesId, series.id))
        .where(eq(userProgress.userId, user.uid))
        .orderBy(desc(userProgress.lastReadAt))
        .limit(10)
        .all();
    },
  }),

  getFavorites: defineAction({
    handler: async (_, context) => {
      const { user } = context.locals;
      if (!user) return [];
      const db = getDB(context.locals.runtime.env);
      return await db
        .select({
          series: {
            id: series.id,
            title: series.title,
            slug: series.slug,
            coverImageUrl: series.coverImageUrl,
            views: series.views,
          },
          createdAt: favorites.createdAt,
        })
        .from(favorites)
        .innerJoin(series, eq(favorites.seriesId, series.id))
        .where(and(eq(favorites.userId, user.uid), eq(favorites.type, 'series')))
        .orderBy(desc(favorites.createdAt))
        .all();
    },
  }),

  getRatings: defineAction({
    handler: async (_, context) => {
      const { user } = context.locals;
      if (!user) return [];
      const db = getDB(context.locals.runtime.env);
      return await db
        .select({
          series: {
            id: series.id,
            title: series.title,
            slug: series.slug,
            coverImageUrl: series.coverImageUrl,
            views: series.views,
          },
          rating: seriesRatings.rating,
          createdAt: seriesRatings.createdAt,
        })
        .from(seriesRatings)
        .innerJoin(series, eq(seriesRatings.seriesId, series.id))
        .where(eq(seriesRatings.userId, user.uid))
        .orderBy(desc(seriesRatings.createdAt))
        .all();
    },
  }),

  updateProfile: defineAction({
    input: ProfileSchema,
    handler: async (input, context) => {
      const { user, runtime } = context.locals;
      if (!user) throw new Error('Unauthorized');

      // Orion: Validación CSRF mediante Nonce
      if (input.nonce) {
        const secret = runtime.env.JWT_SECRET || 'nonce-secret-fallback';
        const isValid = await consumeNonce(input.nonce, secret, user.uid);
        if (!isValid) throw new Error('Security token invalid or expired');
      }

      const db = getDB(runtime.env);
      const { nonce, ...updateData } = input;

      if (updateData.username) {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.username, updateData.username))
          .get();
        if (existing && existing.id !== user.uid) throw new Error('Username taken');
      }

      await db
        .insert(users)
        .values({
          id: user.uid,
          email: user.email || 'no-email',
          username: updateData.username || generateRandomUsername(),
          ...updateData,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { ...updateData, updatedAt: new Date() },
        })
        .run();

      return { success: true };
    },
  }),

  uploadMedia: defineAction({
    accept: 'form',
    input: z.object({
      type: z.enum(['avatar', 'banner']),
      file: z.instanceof(File),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { type, file } = input;
      const { env } = context.locals.runtime;
      const db = getDB(env);

      const currentUser = await db.select().from(users).where(eq(users.id, user.uid)).get();
      const oldUrl = type === 'avatar' ? currentUser?.avatarUrl : currentUser?.bannerUrl;

      if (oldUrl && (oldUrl.includes('avatars/') || oldUrl.includes('banners/'))) {
        try {
          const urlObj = new URL(oldUrl);
          const key = urlObj.pathname.substring(1);
          await env.R2_ASSETS.delete(key);
        } catch (_e) {}
      }

      const ext = file.type.split('/')[1] || 'jpg';
      const folder = type === 'avatar' ? 'avatars' : 'banners';
      const key = `${folder}/${user.uid}-${Date.now()}.${ext}`;

      await env.R2_ASSETS.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
        cacheControl: 'public, max-age=31536000',
      });

      const publicUrl = `${env.R2_PUBLIC_URL_ASSETS}/${key}`;
      const field = type === 'avatar' ? 'avatarUrl' : 'bannerUrl';

      await db
        .insert(users)
        .values({
          id: user.uid,
          email: user.email || 'no-email',
          username: generateRandomUsername(),
          [field]: publicUrl,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { [field]: publicUrl, updatedAt: new Date() },
        })
        .run();

      return { success: true, url: publicUrl };
    },
  }),

  updateProgress: defineAction({
    input: z.object({
      seriesId: z.number(),
      chapterId: z.number(),
      chapterNumber: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) return { success: false, error: 'Unauthorized' };

      const db = getDB(context.locals.runtime.env);
      const now = new Date();

      try {
        // Orion: Asegurar existencia del usuario
        await db
          .insert(users)
          .values({
            id: user.uid,
            email: user.email || `${user.uid}@firebase.auth`,
            username: user.email ? user.email.split('@')[0] : `user_${user.uid.slice(0, 5)}`,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .run();

        // Orion: Upsert manual o robusto para UserProgress
        // Intentamos insertar, si hay conflicto en (userId, seriesId), actualizamos
        await db
          .insert(userProgress)
          .values({
            userId: user.uid,
            seriesId: input.seriesId,
            chapterId: input.chapterId,
            chapterNumber: input.chapterNumber,
            lastReadAt: now,
          })
          .onConflictDoUpdate({
            target: [userProgress.userId, userProgress.seriesId],
            set: {
              chapterId: input.chapterId,
              chapterNumber: input.chapterNumber,
              lastReadAt: now,
            },
          })
          .run();

        return { success: true };
      } catch (err: any) {
        console.error(`[UserAction] updateProgress Failed: ${err.message}`, {
          uid: user.uid,
          input,
        });
        return { success: false, error: err.message };
      }
    },
  }),

  rateSeries: defineAction({
    input: z.object({
      seriesId: z.number(),
      rating: z.number().min(0).max(5),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { seriesId, rating } = input;
      const db = getDB(context.locals.runtime.env);

      if (rating === 0) {
        await db
          .delete(seriesRatings)
          .where(and(eq(seriesRatings.userId, user.uid), eq(seriesRatings.seriesId, seriesId)))
          .run();
      } else {
        await db
          .insert(seriesRatings)
          .values({
            userId: user.uid,
            seriesId,
            rating,
          })
          .onConflictDoUpdate({
            target: [seriesRatings.userId, seriesRatings.seriesId],
            set: { rating },
          })
          .run();
      }

      const stats = await db
        .select({
          avg: sql<number>`AVG(${seriesRatings.rating})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(seriesRatings)
        .where(eq(seriesRatings.seriesId, seriesId))
        .get();

      return {
        success: true,
        newAverage: stats?.avg || 0,
        newCount: stats?.count || 0,
      };
    },
  }),

  toggleFavorite: defineAction({
    input: z.object({
      type: z.enum(['series', 'chapter']),
      id: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { type, id } = input;
      const db = getDB(context.locals.runtime.env);

      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user.uid))
        .get();
      if (!existingUser) {
        await db
          .insert(users)
          .values({
            id: user.uid,
            email: user.email || `${user.uid}@firebase.auth`,
            username: user.email ? user.email.split('@')[0] : `user_${user.uid.slice(0, 5)}`,
          })
          .onConflictDoNothing();
      }

      let existing: typeof favorites.$inferSelect | undefined;
      if (type === 'series') {
        existing = await db
          .select()
          .from(favorites)
          .where(and(eq(favorites.userId, user.uid), eq(favorites.seriesId, id)))
          .get();
      } else {
        existing = await db
          .select()
          .from(favorites)
          .where(and(eq(favorites.userId, user.uid), eq(favorites.chapterId, id)))
          .get();
      }

      if (existing) {
        await db.delete(favorites).where(eq(favorites.id, existing.id));
        return { action: 'removed', id };
      } else {
        await db.insert(favorites).values({
          userId: user.uid,
          type: type,
          seriesId: type === 'series' ? id : null,
          chapterId: type === 'chapter' ? id : null,
        });
        return { action: 'added', id };
      }
    },
  }),
};
