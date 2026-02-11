-- Migration: 0011_add_viewed_at_indices.sql
-- Optimización para consultas de popularidad por rango de tiempo (hoy, semana, mes)

CREATE INDEX IF NOT EXISTS `idx_series_views_viewed_at` ON `SeriesViews` (`viewed_at`);
CREATE INDEX IF NOT EXISTS `idx_chapter_views_viewed_at` ON `ChapterViews` (`viewed_at`);
