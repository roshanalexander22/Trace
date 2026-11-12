use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::Mutex;
use trace_core::types::RpsMove;

#[derive(Debug, Clone)]
pub struct PendingRpsRound {
    pub ai_move: RpsMove,
    pub salt_hex: String,
    pub commitment_sha256: String,
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub pending_rounds: Mutex<HashMap<String, PendingRpsRound>>,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        Self {
            db: Mutex::new(conn),
            pending_rounds: Mutex::new(HashMap::new()),
        }
    }
}

