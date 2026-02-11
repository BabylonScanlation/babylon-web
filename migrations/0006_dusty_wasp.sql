-- Migration 0006: Safe schema refactor to remove 'N/A' defaults and use NULL
PRAGMA foreign_keys=OFF;

-- 1. Create the new table with the desired schema
CREATE TABLE `Series_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`cover_image_url` text,
	`telegram_topic_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`views` integer DEFAULT 0,
	`status` text,
	`type` text,
	`genres` text,
	`author` text,
	`artist` text,
	`published_by` text,
	`demographic` text,
	`alternative_names` text,
	`serialized_by` text,
	`is_hidden` integer DEFAULT 1,
	`is_app_series` integer DEFAULT 0
);

-- 2. Copy data from the old table to the new one, converting 'N/A' to NULL
INSERT INTO `Series_new` (
    id, title, slug, description, cover_image_url, telegram_topic_id, 
    created_at, views, status, type, genres, author, artist, 
    published_by, demographic, alternative_names, serialized_by, 
    is_hidden, is_app_series
)
SELECT 
    id, title, slug, description, cover_image_url, telegram_topic_id, 
    created_at, views,
    NULLIF(status, 'N/A'),
    NULLIF(type, 'N/A'),
    NULLIF(genres, 'N/A'),
    NULLIF(author, 'N/A'),
    NULLIF(artist, 'N/A'),
    NULLIF(published_by, 'N/A'),
    NULLIF(demographic, 'N/A'),
    NULLIF(alternative_names, 'N/A'),
    NULLIF(serialized_by, 'N/A'),
    is_hidden, is_app_series
FROM `Series`;

-- 3. Drop the old table and rename the new one
-- Since foreign_keys is OFF, this won't trigger the cascade delete on Chapters
DROP TABLE `Series`;
ALTER TABLE `Series_new` RENAME TO `Series`;

-- 4. Re-create the unique indexes
CREATE UNIQUE INDEX `Series_slug_unique` ON `Series` (`slug`);
CREATE UNIQUE INDEX `Series_telegram_topic_id_unique` ON `Series` (`telegram_topic_id`);

PRAGMA foreign_keys=ON;