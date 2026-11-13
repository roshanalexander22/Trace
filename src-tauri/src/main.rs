#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
#[allow(non_upper_case_globals)]
#[no_mangle]
pub static NvOptimusEnablement: std::os::raw::c_ulong = 0x00000001;

#[cfg(target_os = "windows")]
#[allow(non_upper_case_globals)]
#[no_mangle]
pub static AmdPowerXpressRequestHighPerformance: std::os::raw::c_int = 1;

fn main() {
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--force_high_performance_gpu --force-high-performance-gpu --gpu-preference=2 --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy",
        );
    }
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
