import {
  Camera,
  Check,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  SwitchCamera,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { CameraState } from "../hooks/useCamera";
import { platform } from "../platform";
import { DEFAULT_CALIBRATION } from "../platform/types";
import { useAppStore } from "../store/useAppStore";

interface SettingsPageProps {
  camera: CameraState;
}

const FINGER_NAMES = ["Thumb IP", "Index", "Middle", "Ring", "Pinky"];

export function SettingsPage({ camera }: SettingsPageProps) {
  const calibration = useAppStore((s) => s.calibration);
  const live = useAppStore((s) => s.live);
  const patchCalibration = useAppStore((s) => s.patchCalibration);
  const setCalibration = useAppStore((s) => s.setCalibration);
  const [savedNotice, setSavedNotice] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);

  const handleDelegateChange = async (val: string) => {
    patchCalibration({ delegate: val });
    const ok = await platform.setGpuPreference(val).catch(() => false);
    if (ok) {
      setNeedsRestart(true);
    }
  };

  const handleSave = async () => {
    await platform.saveCalibration(calibration);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleReset = async () => {
    setCalibration(DEFAULT_CALIBRATION);
    await platform.saveCalibration(DEFAULT_CALIBRATION);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto p-4 md:p-6">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            Calibration & Vision Engine
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Tuning updates the underlying Rust WASM geometry pipeline and 1-Euro filters in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedNotice && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Saved to profile
            </span>
          )}
          <button
            onClick={() => void handleReset()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-2xs hover:bg-[var(--bg-well)] hover:text-[var(--text-primary)] transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Defaults
          </button>
          <button
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-90 transition"
          >
            <Save className="h-3.5 w-3.5" />
            Save Profile
          </button>
        </div>
      </div>

      {/* 2-Column Side-by-Side Responsive Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Column 1: Camera & Inference Runtime */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Camera className="h-4 w-4 text-[var(--accent-primary)]" />
            Camera & Inference Runtime
          </div>

          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">Camera Hardware Device</span>
              <div className="flex items-center gap-2">
                <select
                  value={camera.activeDeviceId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    const nextId = id || null;
                    patchCalibration({ preferred_camera_id: nextId });
                    void platform
                      .saveCalibration({ ...calibration, preferred_camera_id: nextId })
                      .catch(() => {});
                    if (id) void camera.selectDevice(id);
                  }}
                  className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
                >
                  {camera.devices.length === 0 && <option value="">Default Camera</option>}
                  {camera.devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void camera.refreshDevices()}
                  title="Rescan Cameras"
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:opacity-80 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Scan
                </button>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void camera.switchFacingMode()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:opacity-80 transition"
              >
                <SwitchCamera className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>Flip ({camera.facingMode})</span>
              </button>

              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={calibration.mirror_feed}
                  onChange={(e) => patchCalibration({ mirror_feed: e.target.checked })}
                  className="accent-[var(--accent-primary)]"
                />
                Mirror Feed
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-medium text-[var(--text-secondary)]">
                Max Tracking FPS ({calibration.fps_cap} FPS)
              </span>
              <select
                value={calibration.fps_cap}
                onChange={(e) => {
                  const nextFps = Number(e.target.value);
                  patchCalibration({ fps_cap: nextFps });
                }}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
              >
                <option value={15}>15 FPS (Battery Saver)</option>
                <option value={30}>30 FPS (Balanced — Recommended)</option>
                <option value={60}>60 FPS (High Fluidity)</option>
              </select>
            </label>

            {/* 3 Hardware Delegate Options: NVIDIA, CPU, iGPU */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Hardware Acceleration (3 Options)
                </span>
                <button
                  type="button"
                  onClick={() => void platform.openGraphicsSettings()}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Windows Graphics Settings
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Option 1: NVIDIA GeForce RTX */}
                <button
                  type="button"
                  onClick={() => void handleDelegateChange("NVIDIA")}
                  className="flex flex-col p-3 rounded-xl border text-left transition relative cursor-pointer"
                  style={{
                    backgroundColor:
                      (calibration.delegate || "NVIDIA").toUpperCase().includes("NVIDIA") ||
                      calibration.delegate === "GPU"
                        ? "rgba(43, 182, 115, 0.12)"
                        : "var(--bg-well)",
                    borderColor:
                      (calibration.delegate || "NVIDIA").toUpperCase().includes("NVIDIA") ||
                      calibration.delegate === "GPU"
                        ? "var(--status-ready)"
                        : "var(--border-hairline)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: "var(--status-ready)" }}>
                      <Zap className="w-3.5 h-3.5" />
                      NVIDIA GPU (GeForce RTX 3050)
                    </span>
                    {((calibration.delegate || "NVIDIA").toUpperCase().includes("NVIDIA") || calibration.delegate === "GPU") && (
                      <Check className="w-3.5 h-3.5" style={{ color: "var(--status-ready)" }} />
                    )}
                  </div>
                  <span className="text-[11px] mt-1 text-[var(--text-secondary)]">
                    Fastest throughput (~3–5ms). Dedicated 6GB GDDR6 VRAM, CUDA &amp; tensor shaders.
                  </span>
                </button>

                {/* Option 2: CPU SIMD */}
                <button
                  type="button"
                  onClick={() => void handleDelegateChange("CPU")}
                  className="flex flex-col p-3 rounded-xl border text-left transition relative cursor-pointer"
                  style={{
                    backgroundColor:
                      calibration.delegate === "CPU"
                        ? "rgba(2, 132, 199, 0.12)"
                        : "var(--bg-well)",
                    borderColor:
                      calibration.delegate === "CPU"
                        ? "#0284c7"
                        : "var(--border-hairline)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: "#0284c7" }}>
                      CPU (WASM SIMD Multi-Core)
                    </span>
                    {calibration.delegate === "CPU" && (
                      <Check className="w-3.5 h-3.5 text-sky-600" />
                    )}
                  </div>
                  <span className="text-[11px] mt-1 text-[var(--text-secondary)]">
                    Silky smooth (~12–15ms). Zero GPU usage, bypasses graphics drivers completely.
                  </span>
                </button>

                {/* Option 3: Integrated GPU */}
                <button
                  type="button"
                  onClick={() => void handleDelegateChange("iGPU")}
                  className="flex flex-col p-3 rounded-xl border text-left transition relative cursor-pointer"
                  style={{
                    backgroundColor:
                      (calibration.delegate || "").toUpperCase().includes("IGPU")
                        ? "rgba(217, 119, 6, 0.12)"
                        : "var(--bg-well)",
                    borderColor:
                      (calibration.delegate || "").toUpperCase().includes("IGPU")
                        ? "#d97706"
                        : "var(--border-hairline)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5" style={{ color: "#d97706" }}>
                      Integrated GPU (AMD Radeon iGPU)
                    </span>
                    {(calibration.delegate || "").toUpperCase().includes("IGPU") && (
                      <Check className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </div>
                  <span className="text-[11px] mt-1 text-[var(--text-secondary)]">
                    Power saving on battery. Uses shared system memory; higher compute latency (~60–100ms).
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] text-[11px] font-mono">
                <span className="text-[var(--text-secondary)]">Active Device:</span>
                <span className="font-semibold truncate max-w-[280px] text-[var(--text-primary)]" title={live.rendererName || live.activeDelegate}>
                  {live.rendererName || live.activeDelegate}
                </span>
              </div>

              {needsRestart && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs mt-1">
                  <span>Hardware preference saved. Restart to switch active DirectX GPU adapter.</span>
                  <button
                    type="button"
                    onClick={() => void platform.restartApplication()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restart App
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Column 2: Rust Gesture & 1-Euro Filter Calibration */}
        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Sliders className="h-4 w-4 text-[var(--accent-primary)]" />
            Rust Gesture & 1-Euro Filter Calibration
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-[var(--text-secondary)]">Finger Curl Threshold</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)]">
                  {calibration.finger_curl_threshold_deg.toFixed(0)}°
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={95}
                step={1}
                value={calibration.finger_curl_threshold_deg}
                onChange={(e) =>
                  patchCalibration({ finger_curl_threshold_deg: Number(e.target.value) })
                }
                className="accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-[var(--text-secondary)]">Thumb Spread Ratio</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)]">
                  {calibration.thumb_spread_ratio.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.85}
                max={1.6}
                step={0.02}
                value={calibration.thumb_spread_ratio}
                onChange={(e) => patchCalibration({ thumb_spread_ratio: Number(e.target.value) })}
                className="accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-[var(--text-secondary)]">Stability Hysteresis Frames</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)]">
                  {calibration.stability_frames}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={calibration.stability_frames}
                onChange={(e) => patchCalibration({ stability_frames: Number(e.target.value) })}
                className="accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-[var(--text-secondary)]">1-Euro Min Cutoff (Jitter)</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)]">
                  {calibration.one_euro_min_cutoff.toFixed(2)} Hz
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={4.0}
                step={0.1}
                value={calibration.one_euro_min_cutoff}
                onChange={(e) => patchCalibration({ one_euro_min_cutoff: Number(e.target.value) })}
                className="accent-[var(--accent-primary)]"
              />
            </label>
          </div>

          {/* Live Finger Angle Diagnostics with Live Horizontal Progress Bars */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)]/60 p-3 mt-1">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Live Finger Curl Angles</span>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">0° (flat) — 180° (curled)</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {FINGER_NAMES.map((name, i) => {
                const deg = live.fingerAnglesDeg[i] ?? 0;
                const up = live.fingerBitmask[i];
                const pct = Math.min(100, Math.max(0, (deg / 180) * 100));
                return (
                  <div
                    key={name}
                    className={`relative overflow-hidden rounded-lg border p-1.5 transition ${
                      up
                        ? "border-[var(--status-ready)]/60 bg-[var(--bg-surface)] text-[var(--text-primary)]"
                        : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {/* Live Progress Bar Fill */}
                    <div
                      className={`pointer-events-none absolute bottom-0 left-0 top-0 transition-all duration-75 ${
                        up ? "bg-emerald-500/15" : "bg-black/5 dark:bg-white/5"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative z-1 text-[10px] truncate">{name}</div>
                    <div className="relative z-1 font-mono text-xs font-bold tabular-nums">
                      {deg.toFixed(0)}°
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
