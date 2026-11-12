use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use trace_core::drawing::render_strokes_to_svg;
use trace_core::types::StrokeDto;

#[tauri::command]
#[specta::specta]
pub async fn export_artwork_svg(
    app: AppHandle,
    title: String,
    width: u32,
    height: u32,
    strokes: Vec<StrokeDto>,
) -> Result<Option<String>, String> {
    let file_name = format!("{}.svg", title.replace(' ', "_"));
    let path = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter("SVG Vector Artwork", &["svg"])
        .blocking_save_file();

    let Some(file_path) = path else {
        return Ok(None);
    };

    let svg = render_strokes_to_svg(width.max(100), height.max(100), &strokes);
    let path_ref = file_path
        .into_path()
        .map_err(|e| format!("Invalid save path: {e}"))?;
    std::fs::write(&path_ref, svg.as_bytes()).map_err(|e| format!("Failed writing SVG: {e}"))?;
    Ok(Some(path_ref.to_string_lossy().to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn export_artwork_png(
    app: AppHandle,
    title: String,
    png_bytes: Vec<u8>,
) -> Result<Option<String>, String> {
    // Verify valid PNG signature before writing to disk
    if png_bytes.len() < 8 || &png_bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("Invalid PNG payload".to_string());
    }
    let decoder = png::Decoder::new(std::io::Cursor::new(&png_bytes));
    decoder
        .read_info()
        .map_err(|e| format!("Corrupt PNG stream: {e}"))?;

    let file_name = format!("{}.png", title.replace(' ', "_"));
    let path = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .add_filter("PNG Image", &["png"])
        .blocking_save_file();

    let Some(file_path) = path else {
        return Ok(None);
    };
    let path_ref = file_path
        .into_path()
        .map_err(|e| format!("Invalid save path: {e}"))?;
    std::fs::write(&path_ref, &png_bytes).map_err(|e| format!("Failed writing PNG: {e}"))?;
    Ok(Some(path_ref.to_string_lossy().to_string()))
}

