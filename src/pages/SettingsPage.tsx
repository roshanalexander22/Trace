import {
  ArrowLeftRight,
  Camera,
  ExternalLink,
  LayoutGrid,
  Maximize2,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Rows3,
  Save,
  Sliders,
  SwitchCamera,
} from "lucide-react";
import { useState } from "react";
import type { CameraState } from "../hooks/useCamera";
import { platform } from "../platform";
import { DEFAULT_CALIBRATION } from "../platform/types";
import { formatGpuName, formatGpuShort } from "../platform/gpuFormatter";
import {
  useAppStore,
  type CameraVideoFit,
  type GameLayoutPreset,
} from "../store/useAppStore";

interface SettingsPageProps {
  camera: CameraState;
}

const FINGER_NAMES = ["Thumb IP", "Index", "Middle", "Ring", "Pinky"];

export function SettingsPage({ camera }: SettingsPageProps) {
  const theme = useAppStore((s) => s.theme);
  const calibration = useAppStore((s) => s.calibration);
  const live = useAppStore((s) => s.live);
  const gameLayout = useAppStore((s) => s.gameLayout);
  const setGameLayout = useAppStore((s) => s.setGameLayout);
  const cameraFit = useAppStore((s) => s.cameraFit);
  const setCameraFit = useAppStore((s) => s.setCameraFit);
  const swapGamePanels = useAppStore((s) => s.swapGamePanels);
  const patchCalibration = useAppStore((s) => s.patchCalibration);
  const setCalibration = useAppStore((s) => s.setCalibration);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleDelegateChange = async (val: string) => {
    patchCalibration({ delegate: val });
    void platform.saveCalibration({ ...calibration, delegate: val }).catch(() => {});
    if (val !== "CPU") {
      void platform.setGpuPreference(val).catch(() => {});
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
                  void platform.saveCalibration({ ...calibration, fps_cap: nextFps }).catch(() => {});
                }}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                style={{
                  colorScheme: theme === "dark" ? "dark" : "light",
                  backgroundColor: "var(--bg-well)",
                  color: "var(--text-primary)",
                }}
              >
                <option value={15}>15 FPS (Battery Saver)</option>
                <option value={30}>30 FPS (Balanced — Recommended)</option>
                <option value={60}>60 FPS (High Fluidity)</option>
              </select>
            </label>

            {/* Hardware Acceleration Dropdown */}
            <label className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text-secondary)]">Hardware Acceleration</span>
                <button
                  type="button"
                  onClick={() => void platform.openGraphicsSettings()}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Windows Graphics Settings
                </button>
              </div>
              <select
                value={
                  (calibration.delegate || "GPU").toUpperCase() === "CPU"
                    ? "CPU"
                    : "GPU"
                }
                onChange={(e) => void handleDelegateChange(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                style={{
                  colorScheme: theme === "dark" ? "dark" : "light",
                  backgroundColor: "var(--bg-well)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="GPU">{formatGpuName(live.rendererName)} — Hardware Accelerated</option>
                <option value="CPU">CPU (WASM SIMD Multi-Core) — Zero GPU / Battery Saver</option>
              </select>
              <span className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                {(calibration.delegate || "GPU").toUpperCase() === "CPU"
                  ? "Running on multithreaded CPU via WASM SIMD. Zero GPU load. Hot-switching with GPU is instant."
                  : `Running on hardware-accelerated ${formatGpuShort(live.rendererName)} (${formatGpuName(live.rendererName)}). Hot-switching with CPU is instant.`}
              </span>
            </label>

            <div className="flex items-center justify-between px-1 text-[11px] text-[var(--text-secondary)]">
              <span>Active Graphics Adapter</span>
              <span className="font-mono text-[10px] truncate max-w-[260px] text-[var(--text-primary)]" title={live.rendererName || live.activeDelegate}>
                {live.rendererName || live.activeDelegate}
              </span>
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

        {/* Section 3 (Full Width): Game Arena Layout & Presentation Configuration */}
        <section className="lg:col-span-2 flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <LayoutGrid className="h-4 w-4 text-[var(--accent-primary)]" />
              Game Arena Layout & Presentation
            </div>
            <button
              type="button"
              onClick={swapGamePanels}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-well)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] interactive-control hover:opacity-80 transition"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>Swap Left / Right Panels</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: "camera-left" as GameLayoutPreset,
                name: "Classic Left",
                icon: PanelLeft,
                desc: "Camera Stage on Left (58%), Opponent & Scoreboard on Right (42%). Optimal for right-handed setups.",
              },
              {
                id: "camera-right" as GameLayoutPreset,
                name: "Inverted Right",
                icon: PanelRight,
                desc: "Opponent & Scoreboard on Left (42%), Camera Stage on Right (58%). Optimal for streaming or left-handed focus.",
              },
              {
                id: "stadium" as GameLayoutPreset,
                name: "Stadium Showdown",
                icon: Rows3,
                desc: "Top Dual Stage (Camera & Opponent side-by-side), Bottom Full-Width Scoreboard & Timeline stream.",
              },
              {
                id: "cinema" as GameLayoutPreset,
                name: "Cinema Hero",
                icon: Maximize2,
                desc: "Full Expanded Hero Camera Stage with compact HUD side-dock. Maximum gesture tracking immersion.",
              },
            ].map(({ id, name, icon: Icon, desc }) => {
              const active = gameLayout === id;
              return (
                <div
                  key={id}
                  onClick={() => setGameLayout(id)}
                  className={`flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition interactive-control ${
                    active
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)]"
                      : "border-[var(--border-hairline)] bg-[var(--bg-well)]/60 hover:bg-[var(--bg-well)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-bold"
                      style={{ color: active ? "var(--accent-primary)" : "var(--text-primary)" }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      {name}
                    </span>
                    {active && (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Camera Feed Video Fit Mode */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                Webcam Feed Aspect Fit
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Choose how video frames fill the responsive rounded stage container.
              </span>
            </div>

            <div className="inline-flex rounded-xl border border-[var(--border-hairline)] p-1 bg-[var(--bg-well)]">
              {(["cover", "contain"] as CameraVideoFit[]).map((fit) => (
                <button
                  key={fit}
                  type="button"
                  onClick={() => setCameraFit(fit)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize interactive-control transition ${
                    cameraFit === fit
                      ? "bg-[var(--bg-surface)] text-[var(--accent-primary)] font-semibold shadow-2xs"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {fit === "cover" ? "Cover (Full Fill — Zero Void)" : "Contain (Letterbox)"}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
