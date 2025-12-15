CREATE TABLE SeriesRatings (
    series_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (series_id, user_id),
    FOREIGN KEY (series_id) REFERENCES Series(id) ON DELETE CASCADE
);

CREATE TABLE SeriesReactions (
    series_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    reaction_emoji TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (series_id, user_id),
    FOREIGN KEY (series_id) REFERENCES Series(id) ON DELETE CASCADE
);