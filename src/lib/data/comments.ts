import { desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../../db/schema';
import {
  comments,
  commentVotes,
  newsComments,
  newsCommentVotes,
  seriesComments,
  seriesCommentVotes,
  userRoles,
  users,
} from '../../db/schema';
import { parseToTimestamp } from '../utils';

type CommentTable = typeof comments | typeof seriesComments | typeof newsComments;
type VoteTable = typeof commentVotes | typeof seriesCommentVotes | typeof newsCommentVotes;

export async function getCommentsForTarget(
  db: DrizzleD1Database<typeof schema>,
  targetType: 'chapter' | 'series' | 'news',
  targetId: number | string,
  currentUserId?: string
) {
  let table: CommentTable;
  let voteTable: VoteTable;
  let idFilter: SQL;

  if (targetType === 'series') {
    table = seriesComments;
    voteTable = seriesCommentVotes;
    idFilter = eq(seriesComments.seriesId, Number(targetId));
  } else if (targetType === 'news') {
    table = newsComments;
    voteTable = newsCommentVotes;
    idFilter = eq(newsComments.newsId, String(targetId));
  } else {
    table = comments;
    voteTable = commentVotes;
    idFilter = eq(comments.chapterId, Number(targetId));
  }

  const results = await db
    .select({
      id: table.id,
      userId: table.userId,
      parentId: table.parentId,
      commentText: table.commentText,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      isPinned: table.isPinned,
      isDeleted: table.isDeleted,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: userRoles.role,
    })
    .from(table)
    .leftJoin(users, eq(table.userId, users.id))
    .leftJoin(userRoles, eq(table.userId, userRoles.userId))
    .where(idFilter)
    .orderBy(desc(table.isPinned), desc(table.createdAt))
    .all();

  const commentIds = results.map((c) => c.id as number);
  const voteMap = new Map<number, { likes: number; dislikes: number; userVote: number }>();

  if (commentIds.length > 0) {
    const votes = await db
      .select({
        commentId: voteTable.commentId,
        vote: voteTable.vote,
        userId: voteTable.userId,
      })
      .from(voteTable)
      .where(inArray(voteTable.commentId, commentIds))
      .all();

    votes.forEach((v) => {
      const cid = Number(v.commentId);
      if (!voteMap.has(cid))
        voteMap.set(cid, { likes: 0, dislikes: 0, userVote: 0 });
      const stats = voteMap.get(cid)!;
      if (v.vote === 1) stats.likes++;
      if (v.vote === -1) stats.dislikes++;
      if (currentUserId && v.userId === currentUserId) stats.userVote = v.vote;
    });
  }

  return results.map((c) => ({
    ...c,
    userEmail: c.email,
    avatarUrl: c.avatarUrl,
    isOwner: currentUserId ? c.userId === currentUserId : false,
    likes: voteMap.get(c.id as number)?.likes || 0,
    dislikes: voteMap.get(c.id as number)?.dislikes || 0,
    userVote: voteMap.get(c.id as number)?.userVote || 0,
    isAdminComment: c.role === 'admin',
    // Normalizar a timestamps numéricos
    createdAt: parseToTimestamp(c.createdAt),
    updatedAt: parseToTimestamp(c.updatedAt),
  }));
}
