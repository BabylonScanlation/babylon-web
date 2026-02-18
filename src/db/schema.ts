import { sql } from 'drizzle-orm';
import {
  integer,
  real,
  sqliteTable,
  text,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const series = sqliteTable('Series', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  telegramTopicId: integer('telegram_topic_id', { mode: 'number' })
    .notNull()
    .unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  views: integer('views').default(0),
  status: text('status'),
  type: text('type'),
  genres: text('genres'),
  author: text('author'),
  artist: text('artist'),
  publishedBy: text('published_by'),
  demographic: text('demographic'),
  alternativeNames: text('alternative_names'),
  serializedBy: text('serialized_by'),
  isHidden: integer('is_hidden', { mode: 'boolean' }).default(true),
  isNsfw: integer('is_nsfw', { mode: 'boolean' }).default(false),
  isAppSeries: integer('is_app_series', { mode: 'boolean' }).default(false),
}, (table) => [
  index('idx_series_hidden').on(table.isHidden),
  index('idx_series_nsfw').on(table.isNsfw),
  index('idx_series_status').on(table.status),
]);

export const chapters = sqliteTable(
  'Chapters',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    chapterNumber: real('chapter_number').notNull(),
    title: text('title'),
    telegramFileId: text('telegram_file_id').notNull().unique(),
    status: text('status').notNull().default('processing'),
    urlPortada: text('url_portada'),
    views: integer('views').default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    index('idx_chapters_series_id').on(table.seriesId),
    index('idx_chapters_status').on(table.status),
    uniqueIndex('idx_chapters_series_number').on(
      table.seriesId,
      table.chapterNumber
    ),
  ]
);

export const pages = sqliteTable(
  'Pages',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    chapterId: integer('chapter_id', { mode: 'number' })
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    imageUrl: text('image_url').notNull(),
  },
  (table) => [index('idx_pages_chapter_id').on(table.chapterId)]
);

export const anonymousUsers = sqliteTable(
  'AnonymousUsers',
  {
    guestId: text('guest_id').primaryKey(),
    lastIpAddress: text('last_ip_address'),
    fingerprintHash: text('fingerprint_hash'),
    userAgent: text('user_agent'),
    country: text('country'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [uniqueIndex('idx_anon_fingerprint').on(table.fingerprintHash)]
);

export const seriesViews = sqliteTable(
  'SeriesViews',
  {
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address').notNull(),
    viewedAt: integer('viewed_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.seriesId, table.ipAddress] }),
    index('idx_series_views_viewed_at').on(table.viewedAt),
  ]
);

export const users = sqliteTable('Users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  bio: text('bio'),
  website: text('website'),
  socialLinks: text('social_links'),
  preferences: text('preferences'),
  isPrivate: integer('is_private', { mode: 'boolean' }).default(false),
  isNsfw: integer('is_nsfw', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
});

export const userRoles = sqliteTable('UserRoles', {
  userId: text('user_id').primaryKey(),
  role: text('role').notNull(),
});

export const news = sqliteTable(
  'News',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(strftime('%s', 'now') * 1000)`),
    publishedBy: text('published_by').notNull(),
    seriesId: integer('series_id', { mode: 'number' }),
    authorName: text('author_name'),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
  },
  (table) => [index('idx_news_series_id').on(table.seriesId)]
);

export const newsImage = sqliteTable(
  'NewsImage',
  {
    id: text('id').primaryKey(),
    newsId: text('news_id')
      .notNull()
      .references(() => news.id, { onDelete: 'cascade' }),
    r2Key: text('r2_key').notNull(),
    altText: text('alt_text'),
    displayOrder: integer('display_order', { mode: 'number' }).notNull(),
  },
  (table) => [index('idx_news_image_news_id').on(table.newsId)]
);

export const comments = sqliteTable(
  'Comments',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    chapterId: integer('chapter_id', { mode: 'number' })
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    commentText: text('comment_text').notNull(),
    parentId: integer('parent_id', { mode: 'number' }),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [index('idx_comments_chapter_id').on(table.chapterId)]
);

export const seriesComments = sqliteTable(
  'SeriesComments',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    commentText: text('comment_text').notNull(),
    parentId: integer('parent_id', { mode: 'number' }),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [index('idx_series_comments_series_id').on(table.seriesId)]
);

export const newsComments = sqliteTable(
  'NewsComments',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    newsId: text('news_id')
      .notNull()
      .references(() => news.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    commentText: text('comment_text').notNull(),
    parentId: integer('parent_id', { mode: 'number' }),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [index('idx_news_comments_news_id').on(table.newsId)]
);

export const seriesRatings = sqliteTable(
  'SeriesRatings',
  {
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    rating: integer('rating', { mode: 'number' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [primaryKey({ columns: [table.seriesId, table.userId] })]
);

export const seriesReactions = sqliteTable(
  'SeriesReactions',
  {
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    reactionEmoji: text('reaction_emoji').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [primaryKey({ columns: [table.seriesId, table.userId] })]
);

export const chapterViews = sqliteTable(
  'ChapterViews',
  {
    chapterId: integer('chapter_id', { mode: 'number' })
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address').notNull(),
    guestId: text('guest_id'),
    userId: text('user_id'),
    viewedAt: integer('viewed_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.chapterId, table.ipAddress] }),
    index('idx_chapter_views_chapter_id').on(table.chapterId),
    index('idx_chapter_views_user_id').on(table.userId),
    uniqueIndex('idx_chapter_views_guest_chapter').on(
      table.chapterId,
      table.guestId
    ),
    uniqueIndex('idx_chapter_views_user_chapter').on(
      table.chapterId,
      table.userId
    ),
    index('idx_chapter_views_viewed_at').on(table.viewedAt),
  ]
);

export const sessions = sqliteTable('Sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userAgent: text('user_agent'),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [
  index('idx_sessions_expires').on(table.expiresAt)
]);

export const favorites = sqliteTable(
  'Favorites',
  {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    seriesId: integer('series_id', { mode: 'number' }).references(() => series.id, { onDelete: 'cascade' }),
    chapterId: integer('chapter_id', { mode: 'number' }).references(() => chapters.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['series', 'chapter'] }).notNull().default('series'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    index('idx_favorites_user_id').on(table.userId),
    uniqueIndex('idx_favorites_user_series').on(table.userId, table.seriesId),
    uniqueIndex('idx_favorites_user_chapter').on(table.userId, table.chapterId),
  ]
);

// --- VOTING SYSTEMS ---

export const commentVotes = sqliteTable(
  'CommentVotes',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    commentId: integer('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
    vote: integer('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.commentId] }),
    index('idx_comment_votes_comment').on(table.commentId)
  ]
);

export const seriesCommentVotes = sqliteTable(
  'SeriesCommentVotes',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    commentId: integer('comment_id').notNull().references(() => seriesComments.id, { onDelete: 'cascade' }),
    vote: integer('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.commentId] }),
    index('idx_series_comment_votes_comment').on(table.commentId)
  ]
);

export const newsCommentVotes = sqliteTable(
  'NewsCommentVotes',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    commentId: integer('comment_id').notNull().references(() => newsComments.id, { onDelete: 'cascade' }),
    vote: integer('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.commentId] }),
    index('idx_news_comment_votes_comment').on(table.commentId)
  ]
);