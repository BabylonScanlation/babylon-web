CREATE TABLE `Favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`series_id` integer,
	`chapter_id` integer,
	`type` text DEFAULT 'series' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_favorites_user_id` ON `Favorites` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_series` ON `Favorites` (`user_id`,`series_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_chapter` ON `Favorites` (`user_id`,`chapter_id`);