use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use trace_core::types::{CalibrationProfile, StrokeDto};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ArtworkMetaDto {
    pub id: String,
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub stroke_count: u32,
    pub updated_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ArtworkDto {
    pub id: String,
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub strokes: Vec<StrokeDto>,
    pub updated_at: f64,
}

fn now_epoch_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
#[specta::specta]
pub fn load_calibration(state: State<'_, AppState>) -> Result<CalibrationProfile, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let res = conn.query_row(
        "SELECT id, name, finger_curl_threshold_deg, thumb_spread_ratio, stability_frames,
                one_euro_min_cutoff, one_euro_beta, one_euro_d_cutoff,
                preferred_camera_id, mirror_feed, fps_cap, delegate
         FROM calibration_profiles WHERE id = 'default' LIMIT 1",
        [],
        |row| {
            let stab: i64 = row.get(4)?;
            let mirror: i64 = row.get(9)?;
            let fps: i64 = row.get(10)?;
            let mut profile = CalibrationProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                finger_curl_threshold_deg: row.get(2)?,
                thumb_spread_ratio: row.get(3)?,
                stability_frames: stab.clamp(1, 20) as u8,
                one_euro_min_cutoff: row.get(5)?,
                one_euro_beta: row.get(6)?,
                one_euro_d_cutoff: row.get(7)?,
                preferred_camera_id: row.get(8)?,
                mirror_feed: mirror != 0,
                fps_cap: fps.clamp(10, 120) as u32,
                delegate: row.get(11)?,
            };
            if profile.one_euro_min_cutoff < 3.0 || profile.one_euro_beta < 0.2 || profile.fps_cap < 60 {
                profile.one_euro_min_cutoff = 4.5;
                profile.one_euro_beta = 0.5;
                profile.fps_cap = 60;
                profile.stability_frames = 3;
            }
            Ok(profile)
        },
    );

    let profile = match res {
        Ok(p) => p,
        Err(rusqlite::Error::QueryReturnedNoRows) => CalibrationProfile::default(),
        Err(e) => return Err(e.to_string()),
    };

    let _ = conn.execute(
        "UPDATE calibration_profiles SET one_euro_min_cutoff = ?1, one_euro_beta = ?2, fps_cap = ?3, stability_frames = ?4 WHERE id = 'default'",
        rusqlite::params![
            profile.one_euro_min_cutoff,
            profile.one_euro_beta,
            profile.fps_cap as i64,
            profile.stability_frames as i64
        ],
    );
    Ok(profile)
}

#[tauri::command]
#[specta::specta]
pub fn save_calibration(
    state: State<'_, AppState>,
    profile: CalibrationProfile,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO calibration_profiles (
            id, name, finger_curl_threshold_deg, thumb_spread_ratio, stability_frames,
            one_euro_min_cutoff, one_euro_beta, one_euro_d_cutoff,
            preferred_camera_id, mirror_feed, fps_cap, delegate, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            finger_curl_threshold_deg = excluded.finger_curl_threshold_deg,
            thumb_spread_ratio = excluded.thumb_spread_ratio,
            stability_frames = excluded.stability_frames,
            one_euro_min_cutoff = excluded.one_euro_min_cutoff,
            one_euro_beta = excluded.one_euro_beta,
            one_euro_d_cutoff = excluded.one_euro_d_cutoff,
            preferred_camera_id = excluded.preferred_camera_id,
            mirror_feed = excluded.mirror_feed,
            fps_cap = excluded.fps_cap,
            delegate = excluded.delegate,
            updated_at = excluded.updated_at",
        rusqlite::params![
            profile.id,
            profile.name,
            profile.finger_curl_threshold_deg,
            profile.thumb_spread_ratio,
            profile.stability_frames as i64,
            profile.one_euro_min_cutoff,
            profile.one_euro_beta,
            profile.one_euro_d_cutoff,
            profile.preferred_camera_id,
            if profile.mirror_feed { 1 } else { 0 },
            profile.fps_cap as i64,
            profile.delegate,
            now_epoch_secs(),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn save_artwork(state: State<'_, AppState>, artwork: ArtworkDto) -> Result<(), String> {
    let strokes_json = serde_json::to_string(&artwork.strokes).map_err(|e| e.to_string())?;
    let now = now_epoch_secs();
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO artworks (id, title, width, height, strokes_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            width = excluded.width,
            height = excluded.height,
            strokes_json = excluded.strokes_json,
            updated_at = excluded.updated_at",
        rusqlite::params![
            artwork.id,
            artwork.title,
            artwork.width as i64,
            artwork.height as i64,
            strokes_json,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn list_artworks(state: State<'_, AppState>) -> Result<Vec<ArtworkMetaDto>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, width, height, strokes_json, updated_at FROM artworks ORDER BY updated_at DESC LIMIT 20")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let json: String = row.get(4)?;
            let count = serde_json::from_str::<Vec<StrokeDto>>(&json)
                .map(|v| v.len() as u32)
                .unwrap_or(0);
            Ok(ArtworkMetaDto {
                id: row.get(0)?,
                title: row.get(1)?,
                width: row.get::<_, i64>(2)? as u32,
                height: row.get::<_, i64>(3)? as u32,
                stroke_count: count,
                updated_at: row.get::<_, i64>(5)? as f64,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn load_artwork(state: State<'_, AppState>, id: String) -> Result<ArtworkDto, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, width, height, strokes_json, updated_at FROM artworks WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            let json: String = row.get(4)?;
            let strokes = serde_json::from_str::<Vec<StrokeDto>>(&json).unwrap_or_default();
            Ok(ArtworkDto {
                id: row.get(0)?,
                title: row.get(1)?,
                width: row.get::<_, i64>(2)? as u32,
                height: row.get::<_, i64>(3)? as u32,
                strokes,
                updated_at: row.get::<_, i64>(5)? as f64,
            })
        },
    )
    .map_err(|e| e.to_string())
}

