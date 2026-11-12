#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    trace_lib::run()
}

#[cfg(test)]
mod tests {
    use specta_typescript::Typescript;

    #[test]
    fn exports_typescript_bindings() {
        let builder = trace_lib::specta_builder();
        builder
            .export(Typescript::default(), "../src/bindings.ts")
            .expect("Failed to export TypeScript bindings");
    }

    #[test]
    fn sqlite_migration_and_scoreboard_query() {
        let dir = std::env::temp_dir().join("trace_test_db");
        let db_path = dir.join("test_trace.db");
        let _ = std::fs::remove_file(&db_path);
        let conn = trace_lib::db::open_and_migrate(&db_path).expect("migrate");
        let sb = trace_lib::commands::rps::query_scoreboard(&conn).expect("scoreboard");
        assert_eq!(sb.total_rounds, 0);
        let _ = std::fs::remove_file(&db_path);
    }
}
