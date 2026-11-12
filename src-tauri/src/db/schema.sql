CREATE TABLE IF NOT EXISTS calibration_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    finger_curl_threshold_deg REAL NOT NULL,
    thumb_spread_ratio REAL NOT NULL,
    stability_frames INTEGER NOT NULL,
    one_euro_min_cutoff REAL NOT NULL,
    one_euro_beta REAL NOT NULL,
    one_euro_d_cutoff REAL NOT NULL,
    preferred_camera_id TEXT,
    mirror_feed INTEGER NOT NULL,
    fps_cap INTEGER NOT NULL,
    delegate TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rps_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_move TEXT NOT NULL,
    ai_move TEXT NOT NULL,
    outcome TEXT NOT NULL,
    commitment TEXT NOT NULL,
    salt TEXT NOT NULL,
    played_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artworks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    strokes_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

