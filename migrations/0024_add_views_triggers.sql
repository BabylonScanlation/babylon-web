-- Trigger para Series (Sola línea para D1 compatibility)
CREATE TRIGGER IF NOT EXISTS tr_increment_series_views AFTER INSERT ON SeriesViews BEGIN UPDATE Series SET views = IFNULL(views, 0) + 1 WHERE id = NEW.series_id; END;

-- Trigger para Capítulos (Sola línea para D1 compatibility)
CREATE TRIGGER IF NOT EXISTS tr_increment_chapter_views AFTER INSERT ON ChapterViews BEGIN UPDATE Chapters SET views = IFNULL(views, 0) + 1 WHERE id = NEW.chapter_id; END;
