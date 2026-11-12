import { Camera, RefreshCw, Save, Sliders, SwitchCamera } from "lucide-react";
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
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calibration & Performance</h1>
          <p className="text-xs text-slate-600">
            Changes update the Rust WASM vision pipeline in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedNotice && (
            <span className="text-xs font-semibold text-emerald-600">Saved to profile</span>
          )}
          <button
            onClick={() => void handleReset()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Defaults
          </button>
          <button
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500"
          >
            <Save className="h-3.5 w-3.5" />
            Save Profile
          </button>
        </div>
      </div>

      {/* Camera & Runtime Section */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Camera className="h-4 w-4 text-sky-600" />
          Camera & Inference Runtime
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-slate-600">Camera Device</span>
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
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
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
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Scan
              </button>
            </div>
          </label>

          <div className="flex items-end gap-2">
            <button
              onClick={() => void camera.switchFacingMode()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <SwitchCamera className="h-4 w-4 text-sky-600" />
              Flip Front / Rear ({camera.facingMode})
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={calibration.mirror_feed}
                onChange={(e) => patchCalibration({ mirror_feed: e.target.checked })}
                className="accent-sky-600"
              />
              Mirror Feed
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-slate-600">
              Max Tracking FPS ({calibration.fps_cap} FPS)
            </span>
            <select
              value={calibration.fps_cap}
              onChange={(e) => patchCalibration({ fps_cap: Number(e.target.value) })}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            >
              <option value={15}>15 FPS (Battery Saver)</option>
              <option value={30}>30 FPS (Balanced)</option>
              <option value={60}>60 FPS (High Fluidity)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-slate-600">MediaPipe Hardware Delegate</span>
            <select
              value={calibration.delegate}
              onChange={(e) => patchCalibration({ delegate: e.target.value })}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
            >
              <option value="GPU">GPU (WebGL2 — Recommended)</option>
              <option value="CPU">CPU (Compatibility Fallback)</option>
            </select>
          </label>
        </div>
      </section>

      {/* Rust Vision Pipeline Tuning */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sliders className="h-4 w-4 text-indigo-600" />
          Rust Gesture & 1-Euro Filter Calibration
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="font-medium text-slate-700">Finger Curl Threshold</span>
              <span className="font-mono font-semibold text-sky-600">
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
              className="accent-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="font-medium text-slate-700">Thumb Spread Ratio</span>
              <span className="font-mono font-semibold text-sky-600">
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
              className="accent-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="font-medium text-slate-700">Stability Hysteresis Frames</span>
              <span className="font-mono font-semibold text-sky-600">
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
              className="accent-sky-600"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="font-medium text-slate-700">1-Euro Min Cutoff (Anti-Jitter)</span>
              <span className="font-mono font-semibold text-sky-600">
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
              className="accent-sky-600"
            />
          </label>
        </div>

        {/* Live Finger Angle Diagnostics */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Live Finger Curl Angles (Degrees)
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {FINGER_NAMES.map((name, i) => {
              const deg = live.fingerAnglesDeg[i] ?? 0;
              const up = live.fingerBitmask[i];
              return (
                <div
                  key={name}
                  className={`rounded-lg border p-2 ${
                    up
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <div className="text-[11px]">{name}</div>
                  <div className="font-mono text-sm font-bold">{deg.toFixed(0)}°</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

