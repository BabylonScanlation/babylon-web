DROP TABLE `Reports`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_CommentVotes` (
	`user_id` text NOT NULL,
	`comment_id` integer NOT NULL,
	`value` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `Comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_CommentVotes`("user_id", "comment_id", "value", "created_at") SELECT "user_id", "comment_id", "value", "created_at" FROM `CommentVotes`;--> statement-breakpoint
DROP TABLE `CommentVotes`;--> statement-breakpoint
ALTER TABLE `__new_CommentVotes` RENAME TO `CommentVotes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_comment_votes_comment` ON `CommentVotes` (`comment_id`);--> statement-breakpoint
CREATE TABLE `__new_NewsCommentVotes` (
	`user_id` text NOT NULL,
	`comment_id` integer NOT NULL,
	`value` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `NewsComments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_NewsCommentVotes`("user_id", "comment_id", "value", "created_at") SELECT "user_id", "comment_id", "value", "created_at" FROM `NewsCommentVotes`;--> statement-breakpoint
DROP TABLE `NewsCommentVotes`;--> statement-breakpoint
ALTER TABLE `__new_NewsCommentVotes` RENAME TO `NewsCommentVotes`;--> statement-breakpoint
CREATE INDEX `idx_news_comment_votes_comment` ON `NewsCommentVotes` (`comment_id`);--> statement-breakpoint
CREATE TABLE `__new_SeriesCommentVotes` (
	`user_id` text NOT NULL,
	`comment_id` integer NOT NULL,
	`value` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `SeriesComments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_SeriesCommentVotes`("user_id", "comment_id", "value", "created_at") SELECT "user_id", "comment_id", "value", "created_at" FROM `SeriesCommentVotes`;--> statement-breakpoint
DROP TABLE `SeriesCommentVotes`;--> statement-breakpoint
ALTER TABLE `__new_SeriesCommentVotes` RENAME TO `SeriesCommentVotes`;--> statement-breakpoint
CREATE INDEX `idx_series_comment_votes_comment` ON `SeriesCommentVotes` (`comment_id`);--> statement-breakpoint
ALTER TABLE `Comments` ADD `is_pinned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `NewsComments` ADD `is_pinned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `SeriesComments` ADD `is_pinned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `Users` DROP COLUMN `is_banned`;--> statement-breakpoint
ALTER TABLE `Users` DROP COLUMN `ban_reason`;