# Trace — AI Hand Companion (Tauri v2 + Rust + MediaPipe)

An ultra-lightweight, offline-first interactive computer vision desktop & browser application built with **Tauri v2**, **Rust (native + WebAssembly)**, **MediaPipe Tasks Vision**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

## Architecture
- **`crates/trace-core`**: Pure Rust geometry & CV engine (3D bone-angle finger detection, adaptive 1-Euro smoothing filter, temporal hysteresis gesture stabilizer, Ramer-Douglas-Peucker stroke simplification, Catmull-Rom splines, SVG generator, and SHA-256 commit-reveal RPS fairness proof).
- **`crates/trace-wasm`**: WebAssembly wrapper compiled into `src/wasm/` and executed off the main thread inside `src/vision/vision.worker.ts` alongside MediaPipe (`@mediapipe/tasks-vision`).
- **`src-tauri`**: Tauri v2 native Rust shell handling embedded SQLite persistence (`rusqlite`), native OS PNG/SVG file exports, global shortcut (`Ctrl+Shift+T`), process RSS memory telemetry, and OS camera permission helpers.
- **`src/`**: React + TypeScript UI with a dual-mode `PlatformAdapter` (`TauriAdapter` via `tauri-specta` + `WebAdapter` fallback for browser/PWA deployments).

## Commands
```bash
# 1. Fetch offline MediaPipe WASM & hand_landmarker.task (~7.8 MB)
npm run fetch:assets

# 2. Build Rust -> WASM vision pipeline
npm run build:wasm

# 3. Run Rust workspace tests & TypeScript unit tests
cargo test --workspace
npm test

# 4. Run native desktop app in development
npm run tauri dev

# 5. Build lightweight production desktop installer
npm run tauri build
```

> **Windows (`x86_64-pc-windows-gnu`) Tip:** If your Windows user path contains spaces, set `CARGO_TARGET_DIR=C:\Temp\trace-target` before building `src-tauri` so MinGW `windres` receives a space-free output path.

