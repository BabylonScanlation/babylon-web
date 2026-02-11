-- Migración segura: CamelCase a snake_case sin pérdida de datos
-- Tabla: News
ALTER TABLE `News` RENAME COLUMN `createdAt` TO `created_at`;
ALTER TABLE `News` RENAME COLUMN `updatedAt` TO `updated_at`;
ALTER TABLE `News` RENAME COLUMN `publishedBy` TO `published_by`;

-- Tabla: NewsImage
ALTER TABLE `NewsImage` RENAME COLUMN `newsId` TO `news_id`;
ALTER TABLE `NewsImage` RENAME COLUMN `r2Key` TO `r2_key`;
ALTER TABLE `NewsImage` RENAME COLUMN `altText` TO `alt_text`;
ALTER TABLE `NewsImage` RENAME COLUMN `displayOrder` TO `display_order`;

-- Índices (Re-creación necesaria por el cambio de nombre de columna)
DROP INDEX IF EXISTS `idx_news_image_news_id`;
CREATE INDEX `idx_news_image_news_id` ON `NewsImage` (`news_id`);

-- Otros índices de optimización (Aseguramos que existan)
CREATE INDEX IF NOT EXISTS `idx_chapters_status` ON `Chapters` (`status`);
CREATE INDEX IF NOT EXISTS `idx_series_hidden` ON `Series` (`is_hidden`);
CREATE INDEX IF NOT EXISTS `idx_series_nsfw` ON `Series` (`is_nsfw`);
CREATE INDEX IF NOT EXISTS `idx_series_status` ON `Series` (`status`);
CREATE INDEX IF NOT EXISTS `idx_sessions_expires` ON `Sessions` (`expires_at`);
