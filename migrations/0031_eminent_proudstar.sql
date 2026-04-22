CREATE TABLE `Reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` text NOT NULL,
	`chapter_id` integer,
	`series_id` integer,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	FOREIGN KEY (`reporter_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `Chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`series_id`) REFERENCES `Series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `Reports` (`status`);--> statement-breakpoint
CREATE TABLE `ScanlationInvitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scanlation_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`scanlation_id`) REFERENCES `Scanlations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ScanlationInvitations_token_unique` ON `ScanlationInvitations` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invitations_token` ON `ScanlationInvitations` (`token`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_chapters_series_number`;--> statement-breakpoint
ALTER TABLE `Chapters` ADD `scanlation_id` integer REFERENCES Scanlations(id);--> statement-breakpoint
ALTER TABLE `Chapters` ADD `uploader_id` text REFERENCES Users(id);--> statement-breakpoint
ALTER TABLE `Chapters` ADD `volume_number` integer;--> statement-breakpoint
ALTER TABLE `Chapters` ADD `language` text DEFAULT 'es-la' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_chapters_scanlation_id` ON `Chapters` (`scanlation_id`);--> statement-breakpoint
CREATE INDEX `idx_chapters_language` ON `Chapters` (`language`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapters_unique_upload` ON `Chapters` (`series_id`,`chapter_number`,`scanlation_id`,`language`);