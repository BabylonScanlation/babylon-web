-- Migration for adding seriesId to the News table

ALTER TABLE News
ADD COLUMN seriesId TEXT;