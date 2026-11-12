use crate::state::{AppState, PendingRpsRound};
use rand::rngs::OsRng;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use trace_core::rps::{compute_commitment, evaluate_round};
use trace_core::types::{RoundOutcome, RpsMove};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RpsCommitmentDto {
    pub round_id: String,
    pub commitment_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RpsMatchRecordDto {
    pub id: f64,
    pub player_move: RpsMove,
    pub ai_move: RpsMove,
    pub outcome: RoundOutcome,
    pub commitment_sha256: String,
    pub salt_hex: String,
    pub played_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ScoreboardSummaryDto {
    pub player_wins: u32,
    pub ai_wins: u32,
    pub draws: u32,
    pub total_rounds: u32,
    pub current_streak: i32,
    pub win_rate: f32,
    pub recent_matches: Vec<RpsMatchRecordDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RpsResultDto {
    pub player_move: RpsMove,
    pub ai_move: RpsMove,
    pub outcome: RoundOutcome,
    pub commitment_sha256: String,
    pub salt_hex: String,
    pub scoreboard: ScoreboardSummaryDto,
}

fn now_epoch_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn move_to_str(m: RpsMove) -> &'static str {
    match m {
        RpsMove::Rock => "Rock",
        RpsMove::Paper => "Paper",
        RpsMove::Scissors => "Scissors",
    }
}

fn str_to_move(s: &str) -> RpsMove {
    match s {
        "Paper" => RpsMove::Paper,
        "Scissors" => RpsMove::Scissors,
        _ => RpsMove::Rock,
    }
}

fn outcome_to_str(o: RoundOutcome) -> &'static str {
    match o {
        RoundOutcome::PlayerWin => "PlayerWin",
        RoundOutcome::AiWin => "AiWin",
        RoundOutcome::Draw => "Draw",
    }
}

fn str_to_outcome(s: &str) -> RoundOutcome {
    match s {
        "PlayerWin" => RoundOutcome::PlayerWin,
        "AiWin" => RoundOutcome::AiWin,
        _ => RoundOutcome::Draw,
    }
}

pub fn query_scoreboard(conn: &rusqlite::Connection) -> Result<ScoreboardSummaryDto, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, player_move, ai_move, outcome, commitment, salt, played_at
             FROM rps_matches ORDER BY id DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let p_str: String = row.get(1)?;
            let a_str: String = row.get(2)?;
            let o_str: String = row.get(3)?;
            Ok(RpsMatchRecordDto {
                id: row.get::<_, i64>(0)? as f64,
                player_move: str_to_move(&p_str),
                ai_move: str_to_move(&a_str),
                outcome: str_to_outcome(&o_str),
                commitment_sha256: row.get(4)?,
                salt_hex: row.get(5)?,
                played_at: row.get::<_, i64>(6)? as f64,
            })
        })
        .map_err(|e| e.to_string())?;

    let recent_matches: Vec<RpsMatchRecordDto> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let (player_wins, ai_wins, draws): (u32, u32, u32) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN outcome = 'PlayerWin' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'AiWin' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'Draw' THEN 1 ELSE 0 END), 0)
             FROM rps_matches",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut current_streak: i32 = 0;
    for m in &recent_matches {
        match m.outcome {
            RoundOutcome::PlayerWin => {
                if current_streak < 0 {
                    break;
                }
                current_streak += 1;
            }
            RoundOutcome::AiWin => {
                if current_streak > 0 {
                    break;
                }
                current_streak -= 1;
            }
            RoundOutcome::Draw => break,
        }
    }

    let total_rounds = player_wins + ai_wins + draws;
    let decisive = player_wins + ai_wins;
    let win_rate = if decisive > 0 {
        player_wins as f32 / decisive as f32
    } else {
        0.0
    };

    Ok(ScoreboardSummaryDto {
        player_wins,
        ai_wins,
        draws,
        total_rounds,
        current_streak,
        win_rate,
        recent_matches,
    })
}

#[tauri::command]
#[specta::specta]
pub fn rps_start_round(state: State<'_, AppState>) -> Result<RpsCommitmentDto, String> {
    let mut rng = OsRng;
    let ai_move = match rng.gen_range(0..3) {
        0 => RpsMove::Rock,
        1 => RpsMove::Paper,
        _ => RpsMove::Scissors,
    };
    let mut salt_bytes = [0u8; 16];
    rng.fill(&mut salt_bytes);
    let salt_hex: String = salt_bytes.iter().map(|b| format!("{b:02x}")).collect();
    let commitment_sha256 = compute_commitment(ai_move, &salt_hex);
    let round_id = Uuid::new_v4().to_string();

    let mut pending = state.pending_rounds.lock().map_err(|e| e.to_string())?;
    pending.clear();
    pending.insert(
        round_id.clone(),
        PendingRpsRound {
            ai_move,
            salt_hex,
            commitment_sha256: commitment_sha256.clone(),
        },
    );

    Ok(RpsCommitmentDto {
        round_id,
        commitment_sha256,
    })
}

#[tauri::command]
#[specta::specta]
pub fn rps_resolve_round(
    state: State<'_, AppState>,
    round_id: String,
    player_move: RpsMove,
) -> Result<RpsResultDto, String> {
    let round = {
        let mut pending = state.pending_rounds.lock().map_err(|e| e.to_string())?;
        pending
            .remove(&round_id)
            .ok_or_else(|| "Round commitment not found or already resolved".to_string())?
    };

    let outcome = evaluate_round(player_move, round.ai_move);
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO rps_matches (player_move, ai_move, outcome, commitment, salt, played_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            move_to_str(player_move),
            move_to_str(round.ai_move),
            outcome_to_str(outcome),
            round.commitment_sha256,
            round.salt_hex,
            now_epoch_secs(),
        ],
    )
    .map_err(|e| e.to_string())?;

    let scoreboard = query_scoreboard(&conn)?;
    Ok(RpsResultDto {
        player_move,
        ai_move: round.ai_move,
        outcome,
        commitment_sha256: round.commitment_sha256,
        salt_hex: round.salt_hex,
        scoreboard,
    })
}

#[tauri::command]
#[specta::specta]
pub fn rps_get_scoreboard(state: State<'_, AppState>) -> Result<ScoreboardSummaryDto, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    query_scoreboard(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn rps_reset_scoreboard(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM rps_matches", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

