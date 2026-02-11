ALTER TABLE `ChapterViews` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `idx_chapter_views_user_id` ON `ChapterViews` (`user_id`);