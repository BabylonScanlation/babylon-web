-- Migration for creating News and NewsImage tables

CREATE TABLE IF NOT EXISTS News (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    publishedBy TEXT NOT NULL, -- Admin user ID or identifier
    status TEXT NOT NULL DEFAULT 'draft' -- 'draft', 'published'
);

CREATE TABLE IF NOT EXISTS NewsImage (
    id TEXT PRIMARY KEY,
    newsId TEXT NOT NULL,
    r2Key TEXT NOT NULL,
    altText TEXT,
    displayOrder INTEGER NOT NULL,
    FOREIGN KEY (newsId) REFERENCES News(id) ON DELETE CASCADE
);