import { desc, eq, inArray } from 'drizzle-orm';
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

export async function getCommentsForTarget(
  db: DrizzleD1Database<typeof schema>,
  targetType: 'chapter' | 'series' | 'news',
  targetId: number | string,
  currentUserId?: string
) {
  let table: any;
  let voteTable: any;
  let idFilter: any;

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

  const commentIds = results.map((c) => c.id);
  const voteMap = new Map<number, { likes: number; dislikes: number; userVote: number }>();

  if (commentIds.length > 0) {
    const votes = await db
      .select()
      .from(voteTable)
      .where(inArray(voteTable.commentId, commentIds))
      .all();

    votes.forEach((v: any) => {
      if (!voteMap.has(v.commentId))
        voteMap.set(v.commentId, { likes: 0, dislikes: 0, userVote: 0 });
      const stats = voteMap.get(v.commentId)!;
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
    likes: voteMap.get(c.id)?.likes || 0,
    dislikes: voteMap.get(c.id)?.dislikes || 0,
    userVote: voteMap.get(c.id)?.userVote || 0,
    isAdminComment: c.role === 'admin',
  }));
}
