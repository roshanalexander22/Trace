use rusqlite::Connection;
use std::path::Path;

pub fn open_and_migrate(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed creating db dir: {e}"))?;
    }
    let conn = Connection::open(db_path).map_err(|e| format!("Failed opening sqlite: {e}"))?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("SQLite pragma error: {e}"))?;
    conn.execute_batch(include_str!("schema.sql"))
        .map_err(|e| format!("SQLite migration error: {e}"))?;
    Ok(conn)
}

