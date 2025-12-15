CREATE TABLE ChapterViews (
    chapter_id INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    viewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chapter_id, ip_address),
    FOREIGN KEY (chapter_id) REFERENCES Chapters (id) ON DELETE CASCADE
);