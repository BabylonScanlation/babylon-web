ALTER TABLE `Users` ADD `vip_tier` integer DEFAULT 0 NOT NULL;
ALTER TABLE `Users` ADD `vip_expires_at` integer;

CREATE TABLE `Subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tier` integer NOT NULL,
	`status` text DEFAULT 'pending_crypto' NOT NULL,
	`gateway` text NOT NULL,
	`tx_hash` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `Donations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`gateway` text NOT NULL,
	`tx_hash` text,
	`status` text DEFAULT 'pending_crypto' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_subscriptions_user` ON `Subscriptions` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_subscriptions_status` ON `Subscriptions` (`status`);
CREATE INDEX IF NOT EXISTS `idx_donations_user` ON `Donations` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_donations_status` ON `Donations` (`status`);
