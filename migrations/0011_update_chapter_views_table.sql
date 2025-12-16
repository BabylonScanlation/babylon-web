-- Rename the original ChapterViews table
ALTER TABLE ChapterViews RENAME TO Old_ChapterViews;

-- Create the new ChapterViews table with the updated schema
CREATE TABLE ChapterViews (
    chapter_id TEXT NOT NULL,
    ip_address TEXT,
    viewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    guest_id TEXT NOT NULL,
    PRIMARY KEY (chapter_id, guest_id),
    FOREIGN KEY (chapter_id) REFERENCES Chapters(id) ON DELETE CASCADE
);

-- Copy data from Old_ChapterViews to ChapterViews
-- We need to handle cases where guest_id might be NULL in Old_ChapterViews
-- For simplicity and to ensure the new NOT NULL constraint, we will only copy
-- records where guest_id is not NULL. If guest_id could legitimately be NULL
-- and views needed to be tracked solely by IP, a more complex migration
-- involving generating guest_ids for old records or separate tables would be needed.
-- Given the API's current logic, guest_id is expected.
INSERT INTO ChapterViews (chapter_id, ip_address, viewed_at, guest_id)
SELECT chapter_id, ip_address, viewed_at, guest_id
FROM Old_ChapterViews
WHERE guest_id IS NOT NULL;

-- Drop the old table
DROP TABLE Old_ChapterViews;
