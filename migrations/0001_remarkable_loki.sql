ALTER TABLE `Series` ADD `is_app_series` integer DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapters_series_number` ON `Chapters` (`series_id`,`chapter_number`);