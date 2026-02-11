CREATE TABLE `AnonymousUsers` (
	`guest_id` text PRIMARY KEY NOT NULL,
	`last_ip_address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ChapterViews` (
	`chapter_id` integer NOT NULL,
	`ip_address` text NOT NULL,
	`guest_id` text,
	`viewed_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`chapter_id`, `ip_address`),
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chapter_views_chapter_id` ON `ChapterViews` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `Chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`chapter_number` real NOT NULL,
	`title` text,
	`telegram_file_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`url_portada` text,
	`views` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Chapters_telegram_file_id_unique` ON `Chapters` (`telegram_file_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_series_id` ON `Chapters` (`series_id`);--> statement-breakpoint
CREATE TABLE `Comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`comment_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comments_chapter_id` ON `Comments` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `News` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`publishedBy` text NOT NULL,
	`series_id` integer,
	`author_name` text,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_news_series_id` ON `News` (`series_id`);--> statement-breakpoint
CREATE TABLE `NewsImage` (
	`id` text PRIMARY KEY NOT NULL,
	`newsId` text NOT NULL,
	`r2Key` text NOT NULL,
	`altText` text,
	`displayOrder` integer NOT NULL,
	FOREIGN KEY (`newsId`) REFERENCES `News`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_news_image_news_id` ON `NewsImage` (`newsId`);--> statement-breakpoint
CREATE TABLE `Pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`page_number` integer NOT NULL,
	`image_url` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pages_chapter_id` ON `Pages` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `Series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`cover_image_url` text,
	`telegram_topic_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`views` integer DEFAULT 0,
	`status` text DEFAULT 'N/A',
	`type` text DEFAULT 'N/A',
	`genres` text DEFAULT 'N/A',
	`author` text DEFAULT 'N/A',
	`artist` text DEFAULT 'N/A',
	`published_by` text DEFAULT 'N/A',
	`demographic` text DEFAULT 'N/A',
	`alternative_names` text DEFAULT 'N/A',
	`serialized_by` text DEFAULT 'N/A',
	`is_hidden` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Series_slug_unique` ON `Series` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `Series_telegram_topic_id_unique` ON `Series` (`telegram_topic_id`);--> statement-breakpoint
CREATE TABLE `SeriesComments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`comment_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_series_comments_series_id` ON `SeriesComments` (`series_id`);--> statement-breakpoint
CREATE TABLE `SeriesRatings` (
	`series_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`series_id`, `user_id`),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SeriesReactions` (
	`series_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`reaction_emoji` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`series_id`, `user_id`),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `SeriesViews` (
	`series_id` integer NOT NULL,
	`ip_address` text NOT NULL,
	`viewed_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`series_id`, `ip_address`),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `UserRoles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL
);
