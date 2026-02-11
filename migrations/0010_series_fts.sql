-- Migration: 0010_series_fts.sql
-- Create a virtual table for Full-Text Search on Series
CREATE VIRTUAL TABLE series_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    alternative_names,
    author,
    artist,
    content='Series',
    content_rowid='id'
);

-- Populate the FTS table with existing data
INSERT INTO series_fts(rowid, id, title, description, alternative_names, author, artist)
SELECT id, id, title, description, alternative_names, author, artist FROM Series;

-- Triggers to keep the FTS index in sync with the Series table
CREATE TRIGGER series_ai AFTER INSERT ON Series BEGIN
  INSERT INTO series_fts(rowid, id, title, description, alternative_names, author, artist)
  VALUES (new.id, new.id, new.title, new.description, new.alternative_names, new.author, new.artist);
END;

CREATE TRIGGER series_ad AFTER DELETE ON Series BEGIN
  INSERT INTO series_fts(series_fts, rowid, id, title, description, alternative_names, author, artist)
  VALUES('delete', old.id, old.id, old.title, old.description, old.alternative_names, old.author, old.artist);
END;

CREATE TRIGGER series_au AFTER UPDATE ON Series BEGIN
  INSERT INTO series_fts(series_fts, rowid, id, title, description, alternative_names, author, artist)
  VALUES('delete', old.id, old.id, old.title, old.description, old.alternative_names, old.author, old.artist);
  INSERT INTO series_fts(rowid, id, title, description, alternative_names, author, artist)
  VALUES (new.id, new.id, new.title, new.description, new.alternative_names, new.author, new.artist);
END;
