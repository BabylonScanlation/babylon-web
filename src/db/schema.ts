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
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  views: integer('views').default(0),
  status: text('status').default('N/A'),
  type: text('type').default('N/A'),
  genres: text('genres').default('N/A'),
  author: text('author').default('N/A'),
  artist: text('artist').default('N/A'),
  publishedBy: text('published_by').default('N/A'),
  demographic: text('demographic').default('N/A'),
  alternativeNames: text('alternative_names').default('N/A'),
  serializedBy: text('serialized_by').default('N/A'),
  isHidden: integer('is_hidden', { mode: 'boolean' }).default(true),
  isAppSeries: integer('is_app_series', { mode: 'boolean' }).default(false),
});

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
    urlPortada: text('url_portada'), // New column
    views: integer('views').default(0),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_chapters_series_id').on(table.seriesId),
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

export const anonymousUsers = sqliteTable('AnonymousUsers', {
  guestId: text('guest_id').primaryKey(),
  lastIpAddress: text('last_ip_address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const seriesViews = sqliteTable(
  'SeriesViews',
  {
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address').notNull(),
    viewedAt: text('viewed_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.seriesId, table.ipAddress] })]
);

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
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
    publishedBy: text('publishedBy').notNull(),
    seriesId: integer('series_id', { mode: 'number' }),
    authorName: text('author_name'), // New column
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
    newsId: text('newsId')
      .notNull()
      .references(() => news.id, { onDelete: 'cascade' }),
    r2Key: text('r2Key').notNull(),
    altText: text('altText'),
    displayOrder: integer('displayOrder', { mode: 'number' }).notNull(),
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
    userEmail: text('user_email').notNull(),
    commentText: text('comment_text').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
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
    userEmail: text('user_email').notNull(),
    commentText: text('comment_text').notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_series_comments_series_id').on(table.seriesId)]
);

export const seriesRatings = sqliteTable(
  'SeriesRatings',
  {
    seriesId: integer('series_id', { mode: 'number' })
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    rating: integer('rating', { mode: 'number' }).notNull(), // CHECK(rating >= 1 AND rating <= 5) will be handled in migration
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
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
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
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
    guestId: text('guest_id'), // New column
    viewedAt: text('viewed_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.chapterId, table.ipAddress] }),
    index('idx_chapter_views_chapter_id').on(table.chapterId),
  ]
);
