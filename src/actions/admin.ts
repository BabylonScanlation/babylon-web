import { defineAction } from 'astro:actions';
import { isNull, lt } from 'drizzle-orm';
import {
  anonymousUsers,
  chapters,
  chapterViews,
  series,
  seriesViews,
  sessions,
} from '../db/schema';
import { getDB } from '../lib/db';

export const adminActions = {
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
        .where(lt(chapterViews.viewedAt, thirtyDaysAgo.toISOString() as any))
        .run();
      const svDeleted = await db
        .delete(seriesViews)
        .where(lt(seriesViews.viewedAt, thirtyDaysAgo.toISOString() as any))
        .run();
      const sessionsDeleted = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, sessionThreshold))
        .run();
      const anonDeleted = await db
        .delete(anonymousUsers)
        .where(lt(anonymousUsers.updatedAt, sevenDaysAgo.toISOString() as any))
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
