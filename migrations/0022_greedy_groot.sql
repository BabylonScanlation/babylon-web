ALTER TABLE `Comments` ADD `is_deleted` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `NewsComments` ADD `is_deleted` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `SeriesComments` ADD `is_deleted` integer DEFAULT false;