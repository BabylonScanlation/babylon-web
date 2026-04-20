import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { and, eq, isNull, lt } from 'drizzle-orm';
import {
  anonymousUsers,
  chapters,
  chapterViews,
  scanlationMembers,
  scanlations,
  series,
  seriesViews,
  sessions,
  users,
} from '../db/schema';
import { getDB } from '../lib/db';

export const adminActions = {
  createScanlation: defineAction({
    input: z.object({
      name: z.string().min(2),
      slug: z.string().min(2),
      description: z.string().optional(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);

      const [newScan] = await db
        .insert(scanlations)
        .values({
          ...input,
          isActive: true,
        })
        .returning();

      return newScan;
    },
  }),

  addScanMember: defineAction({
    input: z.object({
      scanlationId: z.number(),
      userEmail: z.string().email(),
      role: z.enum(['owner', 'editor', 'moderator']).default('editor'),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);

      // Buscar al usuario por email
      const targetUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.userEmail))
        .get();
      if (!targetUser) throw new Error('Usuario no encontrado con ese email');

      await db
        .insert(scanlationMembers)
        .values({
          scanlationId: input.scanlationId,
          userId: targetUser.id,
          role: input.role,
        })
        .onConflictDoUpdate({
          target: [scanlationMembers.scanlationId, scanlationMembers.userId],
          set: { role: input.role },
        })
        .run();

      return { success: true };
    },
  }),

  removeScanMember: defineAction({
    input: z.object({
      scanlationId: z.number(),
      userId: z.string(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);
      await db
        .delete(scanlationMembers)
        .where(
          and(
            eq(scanlationMembers.scanlationId, input.scanlationId),
            eq(scanlationMembers.userId, input.userId)
          )
        )
        .run();

      return { success: true };
    },
  }),

  toggleScanlationStatus: defineAction({
    input: z.object({
      id: z.number(),
      isActive: z.boolean(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);
      await db
        .update(scanlations)
        .set({ isActive: input.isActive })
        .where(eq(scanlations.id, input.id))
        .run();
      return { success: true };
    },
  }),

  generateScanLinkToken: defineAction({
    input: z.object({
      id: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);
      const token =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      await db
        .update(scanlations)
        .set({ telegramLinkToken: token })
        .where(eq(scanlations.id, input.id))
        .run();

      return { token };
    },
  }),

  unlinkScanTelegram: defineAction({
    input: z.object({
      id: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);
      await db
        .update(scanlations)
        .set({ telegramChatId: null })
        .where(eq(scanlations.id, input.id))
        .run();

      return { success: true };
    },
  }),

  runMaintenance: defineAction({
    handler: async (_, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sessionThreshold = Math.floor(now.getTime() / 1000);

      const cvDeleted = await db
        .delete(chapterViews)
        .where(lt(chapterViews.viewedAt, thirtyDaysAgo))
        .run();
      const svDeleted = await db
        .delete(seriesViews)
        .where(lt(seriesViews.viewedAt, thirtyDaysAgo))
        .run();
      const sessionsDeleted = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, sessionThreshold))
        .run();
      const anonDeleted = await db
        .delete(anonymousUsers)
        .where(lt(anonymousUsers.updatedAt, sevenDaysAgo.toISOString()))
        .run();

      return {
        success: true,
        purged: {
          chapterViews: cvDeleted.changes,
          seriesViews: svDeleted.changes,
          sessions: sessionsDeleted.changes,
          anonymousUsers: anonDeleted.changes,
        },
      };
    },
  }),

  repairDatabase: defineAction({
    handler: async (_, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const db = getDB(context.locals.runtime.env);

      const chaptersResult = await db
        .update(chapters)
        .set({ createdAt: new Date().toISOString() })
        .where(isNull(chapters.createdAt))
        .returning({ id: chapters.id })
        .all();
      const seriesResult = await db
        .update(series)
        .set({ createdAt: new Date().toISOString() })
        .where(isNull(series.createdAt))
        .returning({ id: series.id })
        .all();

      return {
        success: true,
        chaptersFixed: chaptersResult.length,
        seriesFixed: seriesResult.length,
      };
    },
  }),
};
