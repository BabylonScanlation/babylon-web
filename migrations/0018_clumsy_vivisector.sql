CREATE TABLE `Reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`reporter_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `Comments` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `NewsComments` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `SeriesComments` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `Users` ADD `is_banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `Users` ADD `ban_reason` text;