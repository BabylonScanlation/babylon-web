ALTER TABLE `News` ADD `scanlation_id` integer REFERENCES Scanlations(id);--> statement-breakpoint
CREATE INDEX `idx_news_scanlation_id` ON `News` (`scanlation_id`);