ALTER TABLE `Comments` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `NewsComments` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `SeriesComments` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP;