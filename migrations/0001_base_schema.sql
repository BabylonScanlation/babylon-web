
-- Initial schema for Series, Chapters, and Pages
CREATE TABLE Series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    cover_image_url TEXT,
    telegram_topic_id INTEGER NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    chapter_number REAL NOT NULL,
    title TEXT,
    telegram_file_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'live', 'failed')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES Series (id) ON DELETE CASCADE
);

CREATE TABLE Pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES Chapters (id) ON DELETE CASCADE
);

-- Add AnonymousUsers table
CREATE TABLE AnonymousUsers (
    guest_id TEXT PRIMARY KEY,
    last_ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add Series metadata columns
ALTER TABLE Series ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE Series ADD COLUMN status TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN type TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN genres TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN author TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN artist TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN published_by TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN alternative_names TEXT DEFAULT 'N/A';
ALTER TABLE Series ADD COLUMN serialized_by TEXT DEFAULT 'N/A';

-- Create SeriesViews table
CREATE TABLE SeriesViews (
    series_id INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    viewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (series_id, ip_address),
    FOREIGN KEY (series_id) REFERENCES Series (id) ON DELETE CASCADE
);

-- Create UserRoles table
CREATE TABLE UserRoles (
    user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL
);
