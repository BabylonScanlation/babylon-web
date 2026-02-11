CREATE TABLE `NewsComments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`news_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`comment_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`news_id`) REFERENCES `News`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_news_comments_news_id` ON `NewsComments` (`news_id`);