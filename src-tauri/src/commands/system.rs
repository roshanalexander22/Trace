use serde::{Deserialize, Serialize};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SystemTelemetryDto {
    pub memory_mb: f32,
    pub os_platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GpuInfoDto {
    pub active_preference: String,
    pub detected_gpus: Vec<String>,
}

#[cfg(target_os = "windows")]
pub fn apply_gpu_preference(preference: &str) -> Result<(), String> {
    let pref_val = match preference {
        "NVIDIA" | "dGPU" | "GPU" => "GpuPreference=2;",
        "iGPU" => "GpuPreference=1;",
        _ => "GpuPreference=2;",
    };

    let mut target_paths: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        target_paths.push(current_exe);
    }

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let installed = std::path::Path::new(&local_app_data)
            .join("Trace")
            .join("trace.exe");
        target_paths.push(installed);
    }

    let edge_base =
        std::path::Path::new("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application");
    if edge_base.exists() {
        if let Ok(entries) = std::fs::read_dir(edge_base) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("msedgewebview2.exe");
                if candidate.exists() {
                    target_paths.push(candidate);
                }
            }
        }
    }

    for path in target_paths {
        let path_str = path.to_string_lossy();
        let _ = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences",
                "/v",
                &path_str,
                "/t",
                "REG_SZ",
                "/d",
                pref_val,
                "/f",
            ])
            .status();
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_gpu_info() -> Result<GpuInfoDto, String> {
    #[cfg(target_os = "windows")]
    {
        let current_exe = std::env::current_exe().unwrap_or_default();
        let exe_path = current_exe.to_string_lossy().to_string();

        let mut active_pref = "NVIDIA".to_string();
        let mut checked_paths = vec![exe_path];
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            checked_paths.push(
                std::path::Path::new(&local_app_data)
                    .join("Trace")
                    .join("trace.exe")
                    .to_string_lossy()
                    .to_string(),
            );
        }

        for path in checked_paths {
            if let Ok(output) = std::process::Command::new("reg")
                .args([
                    "query",
                    "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences",
                    "/v",
                    &path,
                ])
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                if text.contains("GpuPreference=1") {
                    active_pref = "iGPU".to_string();
                    break;
                } else if text.contains("GpuPreference=2") {
                    active_pref = "NVIDIA".to_string();
                    break;
                }
            }
        }

        let detected = vec![
            "NVIDIA GeForce RTX 3050 6GB Laptop GPU".to_string(),
            "AMD Radeon(TM) Graphics (Integrated iGPU)".to_string(),
        ];

        Ok(GpuInfoDto {
            active_preference: active_pref,
            detected_gpus: detected,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(GpuInfoDto {
            active_preference: "CPU".to_string(),
            detected_gpus: vec![],
        })
    }
}

#[tauri::command]
#[specta::specta]
pub fn set_gpu_preference(preference: String) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        apply_gpu_preference(&preference)?;
        return Ok(true);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = preference;
        Ok(false)
    }
}

#[tauri::command]
#[specta::specta]
pub fn restart_application(app: tauri::AppHandle) {
    app.restart();
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
pub fn open_graphics_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:display-advancedgraphics"])
            .spawn()
            .map_err(|e| format!("Unable to open Windows graphics settings: {e}"))?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
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

