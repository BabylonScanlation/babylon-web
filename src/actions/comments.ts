import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { eq, sql } from 'drizzle-orm';
import {
  comments,
  commentVotes,
  newsComments,
  newsCommentVotes,
  seriesComments,
  seriesCommentVotes,
} from '../db/schema';
import { getDB } from '../lib/db';

const CommentTargetSchema = z.enum(['chapter', 'series', 'news']);

export const commentActions = {
  add: defineAction({
    input: z.object({
      targetType: CommentTargetSchema,
      targetId: z.union([z.string(), z.number()]),
      parentId: z.number().nullable().optional(),
      text: z.string().min(1).max(1000),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { targetType, targetId, parentId, text } = input;
      const db = getDB(context.locals.runtime.env);

      let table: typeof comments | typeof seriesComments | typeof newsComments;
      let targetField: 'chapterId' | 'seriesId' | 'newsId';

      if (targetType === 'chapter') {
        table = comments;
        targetField = 'chapterId';
      } else if (targetType === 'series') {
        table = seriesComments;
        targetField = 'seriesId';
      } else {
        table = newsComments;
        targetField = 'newsId';
      }

      const result = await db
        .insert(table)
        .values({
          [targetField]: targetId,
          userId: user.uid,
          commentText: text,
          parentId: parentId || null,
        })
        .returning({ id: table.id, createdAt: table.createdAt })
        .get();

      return {
        id: result.id,
        text,
        parentId,
        createdAt: new Date(result.createdAt || Date.now()).getTime(),
        user: {
          username: user.username || user.displayName || 'Usuario',
          avatarUrl: user.avatarUrl,
        },
      };
    },
  }),

  delete: defineAction({
    input: z.object({
      targetType: CommentTargetSchema,
      commentId: z.number(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { targetType, commentId } = input;
      const db = getDB(context.locals.runtime.env);

      let table: typeof comments | typeof seriesComments | typeof newsComments;
      if (targetType === 'chapter') table = comments;
      else if (targetType === 'series') table = seriesComments;
      else table = newsComments;

      const existing = await db.select().from(table).where(eq(table.id, commentId)).get();
      if (!existing) throw new Error('Comment not found');
      if (existing.userId !== user.uid && !user.isAdmin) throw new Error('Forbidden');

      await db.update(table).set({ isDeleted: true }).where(eq(table.id, commentId)).run();
      return { success: true };
    },
  }),

  vote: defineAction({
    input: z.object({
      targetType: CommentTargetSchema,
      commentId: z.number(),
      voteType: z.enum(['up', 'down']),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { targetType, commentId, voteType } = input;
      const db = getDB(context.locals.runtime.env);

      let voteTable: typeof commentVotes | typeof seriesCommentVotes | typeof newsCommentVotes;
      if (targetType === 'chapter') voteTable = commentVotes;
      else if (targetType === 'series') voteTable = seriesCommentVotes;
      else voteTable = newsCommentVotes;

      const value = voteType === 'up' ? 1 : -1;

      await db
        .insert(voteTable)
        .values({
          commentId,
          userId: user.uid,
          vote: value,
        })
        .onConflictDoUpdate({
          target: [voteTable.userId, voteTable.commentId],
          set: { vote: value },
        })
        .run();

      return { success: true };
    },
  }),

  edit: defineAction({
    input: z.object({
      targetType: CommentTargetSchema,
      commentId: z.number(),
      text: z.string().min(1).max(1000),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user) throw new Error('Unauthorized');

      const { targetType, commentId, text } = input;
      const db = getDB(context.locals.runtime.env);

      let table: typeof comments | typeof seriesComments | typeof newsComments;
      if (targetType === 'chapter') table = comments;
      else if (targetType === 'series') table = seriesComments;
      else table = newsComments;

      const existing = await db.select().from(table).where(eq(table.id, commentId)).get();
      if (!existing) throw new Error('Comment not found');
      if (existing.userId !== user.uid) throw new Error('Forbidden');

      await db
        .update(table)
        .set({
          commentText: text,
          updatedAt: sql`(strftime('%s', 'now') * 1000)`,
        })
        .where(eq(table.id, commentId))
        .run();

      return { success: true };
    },
  }),

  pin: defineAction({
    input: z.object({
      targetType: CommentTargetSchema,
      commentId: z.number(),
      isPinned: z.boolean(),
    }),
    handler: async (input, context) => {
      const { user } = context.locals;
      if (!user?.isAdmin) throw new Error('Unauthorized');

      const { targetType, commentId, isPinned } = input;
      const db = getDB(context.locals.runtime.env);

      let table: typeof comments | typeof seriesComments | typeof newsComments;
      if (targetType === 'chapter') table = comments;
      else if (targetType === 'series') table = seriesComments;
      else table = newsComments;

      await db.update(table).set({ isPinned }).where(eq(table.id, commentId)).run();
      return { success: true };
    },
  }),
};
