CREATE TABLE `ScanlationMembers` (
	`scanlation_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`joined_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	PRIMARY KEY(`scanlation_id`, `user_id`),
	FOREIGN KEY (`scanlation_id`) REFERENCES `Scanlations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scanlation_members_user` ON `ScanlationMembers` (`user_id`);--> statement-breakpoint
CREATE TABLE `Scanlations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`avatar_url` text,
	`banner_url` text,
	`website` text,
	`social_links` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Scanlations_slug_unique` ON `Scanlations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_scanlations_slug` ON `Scanlations` (`slug`);--> statement-breakpoint
ALTER TABLE `Series` ADD `scanlation_id` integer REFERENCES Scanlations(id);--> statement-breakpoint
CREATE INDEX `idx_series_scanlation_id` ON `Series` (`scanlation_id`);--> statement-breakpoint
CREATE INDEX `idx_series_type` ON `Series` (`type`);--> statement-breakpoint
CREATE INDEX `idx_series_author` ON `Series` (`author`);--> statement-breakpoint
CREATE INDEX `idx_series_artist` ON `Series` (`artist`);