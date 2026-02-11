ALTER TABLE `AnonymousUsers` ADD `fingerprint_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_anon_fingerprint` ON `AnonymousUsers` (`fingerprint_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_views_guest_chapter` ON `ChapterViews` (`chapter_id`,`guest_id`);