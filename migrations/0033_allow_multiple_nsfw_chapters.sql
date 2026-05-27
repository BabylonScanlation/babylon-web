-- Custom SQL migration file, generated manually
DROP INDEX IF EXISTS idx_chapters_unique_upload;

CREATE UNIQUE INDEX idx_chapters_unique_upload ON Chapters(series_id, chapter_number, scanlation_id, language, is_nsfw);
