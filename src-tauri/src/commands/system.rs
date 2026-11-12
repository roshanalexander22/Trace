use serde::{Deserialize, Serialize};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SystemTelemetryDto {
    pub memory_mb: f32,
    pub os_platform: String,
}

#[tauri::command]
#[specta::specta]
pub fn get_system_telemetry() -> Result<SystemTelemetryDto, String> {
    let mut sys = System::new();
    let pid = Pid::from_u32(std::process::id());
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::nothing().with_memory(),
    );
    let memory_mb = sys
        .process(pid)
        .map(|p| (p.memory() as f32) / (1024.0 * 1024.0))
        .unwrap_or(0.0);

    Ok(SystemTelemetryDto {
        memory_mb,
        os_platform: std::env::consts::OS.to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub fn open_camera_privacy_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:privacy-webcam"])
            .spawn()
            .map_err(|e| format!("Unable to open Windows camera settings: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Camera")
            .spawn()
            .map_err(|e| format!("Unable to open macOS camera settings: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        Err("Open your desktop environment's privacy/webcam settings or grant camera permissions in WebKitGTK.".to_string())
    }
}

#[tauri::command]
#[specta::specta]
pub fn reset_webview_camera_permissions(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = app.path().app_local_data_dir() {
            let prefs = local_app_data
                .join("EBWebView")
                .join("Default")
                .join("Preferences");
            if prefs.exists() {
                std::fs::remove_file(&prefs)
                    .map_err(|e| format!("Failed clearing WebView2 preferences: {e}"))?;
                return Ok(true);
            }
        }
        return Ok(false);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(false)
    }
}

