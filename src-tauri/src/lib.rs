pub mod commands;
pub mod db;
pub mod state;

use commands::{export, rps, storage, system};
#[cfg(any(debug_assertions, test))]
use specta_typescript::Typescript;
use state::AppState;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_specta::{collect_commands, Builder};

pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        rps::rps_start_round,
        rps::rps_resolve_round,
        rps::rps_get_scoreboard,
        rps::rps_reset_scoreboard,
        storage::load_calibration,
        storage::save_calibration,
        storage::save_artwork,
        storage::list_artworks,
        storage::load_artwork,
        export::export_artwork_svg,
        export::export_artwork_png,
        system::get_system_telemetry,
        system::open_camera_privacy_settings,
        system::reset_webview_camera_permissions,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let db_path = data_dir.join("trace.db");
            let conn = db::open_and_migrate(&db_path)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            app.manage(AppState::new(conn));

            let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyT);
            let app_handle = app.handle().clone();
            let _ = app.global_shortcut().on_shortcut(toggle_shortcut, move |_app, _sc, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    let _ = app_handle.emit("trace://toggle-tracking", ());
                }
            });

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running Trace");
}
