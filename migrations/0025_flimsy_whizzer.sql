DROP TRIGGER IF EXISTS tr_increment_series_views;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tr_increment_chapter_views;
--> statement-breakpoint
CREATE TABLE `Nonces` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_nonces_expires` ON `Nonces` (`expires_at`);--> statement-breakpoint
CREATE TABLE `UserProgress` (
	`user_id` text NOT NULL,
	`series_id` integer NOT NULL,
	`chapter_id` integer NOT NULL,
	`chapter_number` real NOT NULL,
	`last_read_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY(`user_id`, `series_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_progress_user` ON `UserProgress` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_AnonymousUsers` (
	`guest_id` text PRIMARY KEY NOT NULL,
	`last_ip_address` text,
	`fingerprint_hash` text,
	`user_agent` text,
	`country` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_AnonymousUsers`(`guest_id`, `last_ip_address`, `fingerprint_hash`, `user_agent`, `country`, `created_at`, `updated_at`) SELECT `guest_id`, `last_ip_address`, `fingerprint_hash`, `user_agent`, `country`, `created_at`, `updated_at` FROM `AnonymousUsers`;--> statement-breakpoint
DROP TABLE `AnonymousUsers`;--> statement-breakpoint
ALTER TABLE `__new_AnonymousUsers` RENAME TO `AnonymousUsers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_anon_fingerprint` ON `AnonymousUsers` (`fingerprint_hash`);--> statement-breakpoint
CREATE TABLE `__new_ChapterViews` (
	`chapter_id` integer NOT NULL,
	`ip_address` text NOT NULL,
	`guest_id` text,
	`user_id` text,
	`viewed_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY(`chapter_id`, `ip_address`),
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ChapterViews`(`chapter_id`, `ip_address`, `guest_id`, `user_id`, `viewed_at`) SELECT `chapter_id`, `ip_address`, `guest_id`, `user_id`, `viewed_at` FROM `ChapterViews`;--> statement-breakpoint
DROP TABLE `ChapterViews`;--> statement-breakpoint
ALTER TABLE `__new_ChapterViews` RENAME TO `ChapterViews`;--> statement-breakpoint
CREATE INDEX `idx_chapter_views_chapter_id` ON `ChapterViews` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `idx_chapter_views_user_id` ON `ChapterViews` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_views_guest_chapter` ON `ChapterViews` (`chapter_id`,`guest_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_views_user_chapter` ON `ChapterViews` (`chapter_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chapter_views_viewed_at` ON `ChapterViews` (`viewed_at`);--> statement-breakpoint
CREATE TABLE `__new_Chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`chapter_number` real NOT NULL,
	`title` text,
	`telegram_file_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`url_portada` text,
	`views` integer DEFAULT 0,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Chapters`(`id`, `series_id`, `chapter_number`, `title`, `telegram_file_id`, `status`, `url_portada`, `views`, `created_at`) SELECT `id`, `series_id`, `chapter_number`, `title`, `telegram_file_id`, `status`, `url_portada`, `views`, `created_at` FROM `Chapters`;--> statement-breakpoint
DROP TABLE `Chapters`;--> statement-breakpoint
ALTER TABLE `__new_Chapters` RENAME TO `Chapters`;--> statement-breakpoint
CREATE UNIQUE INDEX `Chapters_telegram_file_id_unique` ON `Chapters` (`telegram_file_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_series_id` ON `Chapters` (`series_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_status` ON `Chapters` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapters_series_number` ON `Chapters` (`series_id`,`chapter_number`);--> statement-breakpoint
CREATE TABLE `__new_CommentVotes` (
	`user_id` text NOT NULL,
	`comment_id` integer NOT NULL,
	`value` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `Comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_CommentVotes`(`user_id`, `comment_id`, `value`, `created_at`) SELECT `user_id`, `comment_id`, `value`, `created_at` FROM `CommentVotes`;--> statement-breakpoint
DROP TABLE `CommentVotes`;--> statement-breakpoint
ALTER TABLE `__new_CommentVotes` RENAME TO `CommentVotes`;--> statement-breakpoint
CREATE INDEX `idx_comment_votes_comment` ON `CommentVotes` (`comment_id`);--> statement-breakpoint
CREATE TABLE `__new_Comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`comment_text` text NOT NULL,
	`parent_id` integer,
	`is_pinned` integer DEFAULT false,
	`is_deleted` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Comments`(`id`, `chapter_id`, `user_id`, `comment_text`, `parent_id`, `is_pinned`, `is_deleted`, `created_at`, `updated_at`) SELECT `id`, `chapter_id`, `user_id`, `comment_text`, `parent_id`, `is_pinned`, `is_deleted`, `created_at`, `updated_at` FROM `Comments`;--> statement-breakpoint
DROP TABLE `Comments`;--> statement-breakpoint
ALTER TABLE `__new_Comments` RENAME TO `Comments`;--> statement-breakpoint
CREATE INDEX `idx_comments_chapter_id` ON `Comments` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `__new_Favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`series_id` integer,
	`chapter_id` integer,
	`type` text DEFAULT 'series' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Favorites`(`id`, `user_id`, `series_id`, `chapter_id`, `type`, `created_at`) SELECT `id`, `user_id`, `series_id`, `chapter_id`, `type`, `created_at` FROM `Favorites`;--> statement-breakpoint
DROP TABLE `Favorites`;--> statement-breakpoint
ALTER TABLE `__new_Favorites` RENAME TO `Favorites`;--> statement-breakpoint
CREATE INDEX `idx_favorites_user_id` ON `Favorites` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_series` ON `Favorites` (`user_id`,`series_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_chapter` ON `Favorites` (`user_id`,`chapter_id`);--> statement-breakpoint
CREATE TABLE `__new_News` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`published_by` text NOT NULL,
	`series_id` integer,
	`author_name` text,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_News`(`id`, `title`, `content`, `created_at`, `updated_at`, `published_by`, `series_id`, `author_name`, `status`) SELECT `id`, `title`, `content`, `created_at`, `updated_at`, `published_by`, `series_id`, `author_name`, `status` FROM `News`;--> statement-breakpoint
DROP TABLE `News`;--> statement-breakpoint
ALTER TABLE `__new_News` RENAME TO `News`;--> statement-breakpoint
CREATE INDEX `idx_news_series_id` ON `News` (`series_id`);--> statement-breakpoint
CREATE INDEX `idx_news_status` ON `News` (`status`);--> statement-breakpoint
CREATE TABLE `__new_NewsCommentVotes` (
	`user_id` text NOT NULL,
	`comment_id` integer NOT NULL,
	`value` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `NewsComments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_NewsCommentVotes`(`user_id`, `comment_id`, `value`, `created_at`) SELECT `user_id`, `comment_id`, `value`, `created_at` FROM `NewsCommentVotes`;--> statement-breakpoint
DROP TABLE `NewsCommentVotes`;--> statement-breakpoint
ALTER TABLE `__new_NewsCommentVotes` RENAME TO `NewsCommentVotes`;--> statement-breakpoint
CREATE INDEX `idx_news_comment_votes_comment` ON `NewsCommentVotes` (`comment_id`);--> statement-breakpoint
CREATE TABLE `__new_NewsComments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`news_id` text NOT NULL,
	`user_id` text NOT NULL,
	`comment_text` text NOT NULL,
	`parent_id` integer,
	`is_pinned` integer DEFAULT false,
	`is_deleted` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`news_id`) REFERENCES `News`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_NewsComments`(`id`, `news_id`, `user_id`, `comment_text`, `parent_id`, `is_pinned`, `is_deleted`, `created_at`, `updated_at`) SELECT `id`, `news_id`, `user_id`, `comment_text`, `parent_id`, `is_pinned`, `is_deleted`, `created_at`, `updated_at` FROM `NewsComments`;--> statement-breakpoint
DROP TABLE `NewsComments`;--> statement-breakpoint
ALTER TABLE `__new_NewsComments` RENAME TO `NewsComments`;--> statement-breakpoint
CREATE INDEX `idx_news_comments_news_id` ON `NewsComments` (`news_id`);--> statement-breakpoint
CREATE TABLE `__new_Series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`cover_image_url` text,
	`telegram_topic_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`views` integer DEFAULT 0,
	`status` text,
	`type` text,
	`genres` text,
	`author` text,
	`artist` text,
	`published_by` text,
	`demographic` text,
	`alternative_names` text,
	`serialized_by` text,
	`is_hidden` integer DEFAULT true,
	`is_nsfw` integer DEFAULT false,
	`is_app_series` integer DEFAULT false
);
--> statement-breakpoint
INSERT INTO `__new_Series`(`id`, `title`, `slug`, `description`, `cover_image_url`, `telegram_topic_id`, `created_at`, `views`, `status`, `type`, `genres`, `author`, `artist`, `published_by`, `demographic`, `alternative_names`, `serialized_by`, `is_hidden`, `is_nsfw`, `is_app_series`) SELECT `id`, `title`, `slug`, `description`, `cover_image_url`, `telegram_topic_id`, `created_at`, `views`, `status`, `type`, `genres`, `author`, `artist`, `published_by`, `demographic`, `alternative_names`, `serialized_by`, `is_hidden`, `is_nsfw`, `is_app_series` FROM `Series`;--> statement-breakpoint
DROP TABLE `Series`;--> statement-breakpoint
ALTER TABLE `__new_Series` RENAME TO `Series`;--> statement-breakpoint
CREATE UNIQUE INDEX `Series_slug_unique` ON `Series` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `Series_telegram_topic_id_unique` ON `Series` (`telegram_topic_id`);--> statement-breakpoint
CREATE INDEX `idx_series_hidden` ON `Series` (`is_hidden`);--> statement-breakpoint
CREATE INDEX `idx_series_nsfw` ON `Series` (`is_nsfw`);--> statement-breakpoint
CREATE INDEX `idx_series_status` ON `Series` (`status`);--> statement-breakpoint
CREATE TABLE `__new_SeriesCommentVotes` (
	`user_id` text NOT NULL,
	`comment_id` integer NOT NULL,
	`value` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `SeriesComments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_SeriesCommentVotes`(`user_id`, `comment_id`, `value`, `created_at`) SELECT `user_id`, `comment_id`, `value`, `created_at` FROM `SeriesCommentVotes`;--> statement-breakpoint
DROP TABLE `SeriesCommentVotes`;--> statement-breakpoint
ALTER TABLE `__new_SeriesCommentVotes` RENAME TO `SeriesCommentVotes`;--> statement-breakpoint
CREATE INDEX `idx_series_comment_votes_comment` ON `SeriesCommentVotes` (`comment_id`);--> statement-breakpoint
CREATE TABLE `__new_SeriesComments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`comment_text` text NOT NULL,
	`parent_id` integer,
	`is_pinned` integer DEFAULT false,
	`is_deleted` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_SeriesComments`(`id`, `series_id`, `user_id`, `comment_text`, `parent_id`, `is_pinned`, `is_deleted`, `created_at`, `updated_at`) SELECT `id`, `series_id`, `user_id`, `comment_text`, `parent_id`, `is_pinned`, `is_deleted`, `created_at`, `updated_at` FROM `SeriesComments`;--> statement-breakpoint
DROP TABLE `SeriesComments`;--> statement-breakpoint
ALTER TABLE `__new_SeriesComments` RENAME TO `SeriesComments`;--> statement-breakpoint
CREATE INDEX `idx_series_comments_series_id` ON `SeriesComments` (`series_id`);--> statement-breakpoint
CREATE TABLE `__new_SeriesRatings` (
	`series_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY(`series_id`, `user_id`),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_SeriesRatings`(`series_id`, `user_id`, `rating`, `created_at`) SELECT `series_id`, `user_id`, `rating`, `created_at` FROM `SeriesRatings`;--> statement-breakpoint
DROP TABLE `SeriesRatings`;--> statement-breakpoint
ALTER TABLE `__new_SeriesRatings` RENAME TO `SeriesRatings`;--> statement-breakpoint
CREATE TABLE `__new_SeriesReactions` (
	`series_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`reaction_emoji` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY(`series_id`, `user_id`),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_SeriesReactions`(`series_id`, `user_id`, `reaction_emoji`, `created_at`) SELECT `series_id`, `user_id`, `reaction_emoji`, `created_at` FROM `SeriesReactions`;--> statement-breakpoint
DROP TABLE `SeriesReactions`;--> statement-breakpoint
ALTER TABLE `__new_SeriesReactions` RENAME TO `SeriesReactions`;--> statement-breakpoint
CREATE TABLE `__new_SeriesViews` (
	`series_id` integer NOT NULL,
	`ip_address` text NOT NULL,
	`viewed_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY(`series_id`, `ip_address`),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_SeriesViews`(`series_id`, `ip_address`, `viewed_at`) SELECT `series_id`, `ip_address`, `viewed_at` FROM `SeriesViews`;--> statement-breakpoint
DROP TABLE `SeriesViews`;--> statement-breakpoint
ALTER TABLE `__new_SeriesViews` RENAME TO `SeriesViews`;--> statement-breakpoint
CREATE INDEX `idx_series_views_viewed_at` ON `SeriesViews` (`viewed_at`);--> statement-breakpoint
CREATE TABLE `__new_Users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text,
	`display_name` text,
	`avatar_url` text,
	`banner_url` text,
	`bio` text,
	`website` text,
	`social_links` text,
	`preferences` text,
	`is_private` integer DEFAULT false,
	`is_nsfw` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000)
);
--> statement-breakpoint
INSERT INTO `__new_Users`(`id`, `email`, `username`, `display_name`, `avatar_url`, `banner_url`, `bio`, `website`, `social_links`, `preferences`, `is_private`, `is_nsfw`, `created_at`, `updated_at`) SELECT `id`, `email`, `username`, `display_name`, `avatar_url`, `banner_url`, `bio`, `website`, `social_links`, `preferences`, `is_private`, `is_nsfw`, `created_at`, `updated_at` FROM `Users`;--> statement-breakpoint
DROP TABLE `Users`;--> statement-breakpoint
ALTER TABLE `__new_Users` RENAME TO `Users`;--> statement-breakpoint
CREATE UNIQUE INDEX `Users_email_unique` ON `Users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `Users_username_unique` ON `Users` (`username`);
--> statement-breakpoint
CREATE TRIGGER tr_increment_series_views AFTER INSERT ON SeriesViews BEGIN UPDATE Series SET views = IFNULL(views, 0) + 1 WHERE id = NEW.series_id; END;
--> statement-breakpoint
CREATE TRIGGER tr_increment_chapter_views AFTER INSERT ON ChapterViews BEGIN UPDATE Chapters SET views = IFNULL(views, 0) + 1 WHERE id = NEW.chapter_id; END;

