CREATE TABLE `EpisodeServers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chapter_id` integer NOT NULL,
	`server_name` text NOT NULL,
	`iframe_url` text NOT NULL,
	`language` text DEFAULT 'es-la' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_direct_video` integer DEFAULT false,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_episode_servers_chapter_id` ON `EpisodeServers` (`chapter_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`scanlation_id` integer,
	`uploader_id` text,
	`chapter_number` real NOT NULL,
	`volume_number` integer,
	`language` text DEFAULT 'es-la' NOT NULL,
	`title` text,
	`telegram_file_id` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`url_portada` text,
	`views` integer DEFAULT 0,
	`is_nsfw` integer DEFAULT false,
	`min_vip_tier` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scanlation_id`) REFERENCES `Scanlations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploader_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_Chapters`("id", "series_id", "scanlation_id", "uploader_id", "chapter_number", "volume_number", "language", "title", "telegram_file_id", "status", "url_portada", "views", "is_nsfw", "min_vip_tier", "created_at") SELECT "id", "series_id", "scanlation_id", "uploader_id", "chapter_number", "volume_number", "language", "title", "telegram_file_id", "status", "url_portada", "views", "is_nsfw", "min_vip_tier", "created_at" FROM `Chapters`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `tr_increment_chapter_views`;--> statement-breakpoint
DROP TABLE `Chapters`;--> statement-breakpoint
ALTER TABLE `__new_Chapters` RENAME TO `Chapters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TRIGGER tr_increment_chapter_views AFTER INSERT ON ChapterViews BEGIN UPDATE Chapters SET views = IFNULL(views, 0) + 1 WHERE id = NEW.chapter_id; END;--> statement-breakpoint
CREATE UNIQUE INDEX `Chapters_telegram_file_id_unique` ON `Chapters` (`telegram_file_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_series_id` ON `Chapters` (`series_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_scanlation_id` ON `Chapters` (`scanlation_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_language` ON `Chapters` (`language`);--> statement-breakpoint
CREATE INDEX `idx_chapters_status` ON `Chapters` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapters_unique_upload` ON `Chapters` (`series_id`,`chapter_number`,`scanlation_id`,`language`,`is_nsfw`);