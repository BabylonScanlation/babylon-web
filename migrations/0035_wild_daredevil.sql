CREATE TABLE `ChapterDownloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`chapter_id` integer NOT NULL,
	`downloaded_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chapter_downloads_user` ON `ChapterDownloads` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chapter_downloads_date` ON `ChapterDownloads` (`downloaded_at`);--> statement-breakpoint
ALTER TABLE `Chapters` ADD `min_vip_tier` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Users` ADD `profile_config` text;