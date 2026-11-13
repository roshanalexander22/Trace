import {
  Camera,
  CameraOff,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CameraState } from "../../hooks/useCamera";
import { platform } from "../../platform";
import { useAppStore, type AppMode } from "../../store/useAppStore";

interface TopHeaderProps {
  camera: CameraState;
}

const TITLE_MAP: Record<AppMode, { title: string; subtitle: string }> = {
  home: { title: "Overview", subtitle: "Studio Hand Companion" },
  rps: { title: "RPS Arena", subtitle: "3-2-1 Animated Showdown" },
  split: { title: "Split (Chopsticks)", subtitle: "Tactile Finger Duel" },
  cricket: { title: "Hand Cricket", subtitle: "0–6 Bat & Bowl Duel" },
  canvas: { title: "Air Canvas", subtitle: "1-Euro Mid-Air Studio" },
  settings: { title: "Calibration", subtitle: "Rust WASM Pipeline Tuning" },
};

export function TopHeader({ camera }: TopHeaderProps) {
  const mode = useAppStore((s) => s.mode);
  const theme = useAppStore((s) => s.theme);
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const toggleCamera = useAppStore((s) => s.toggleCamera);
  const trackingEnabled = useAppStore((s) => s.trackingEnabled);
  const toggleTracking = useAppStore((s) => s.toggleTracking);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const setSoundEnabled = useAppStore((s) => s.setSoundEnabled);
  const patchCalibration = useAppStore((s) => s.patchCalibration);

  const viewMeta = TITLE_MAP[mode] ?? TITLE_MAP.home;

  const handleSelectCamera = async (id: string) => {
    const nextId = id || null;
    patchCalibration({ preferred_camera_id: nextId });
    const latestCal = { ...useAppStore.getState().calibration, preferred_camera_id: nextId };
    void platform.saveCalibration(latestCal).catch(() => {});
    if (nextId) {
      await camera.selectDevice(nextId);
    } else {
      await camera.startCamera(null);
    }
  };

  return (
    <header
      className="flex items-center justify-between h-[42px] px-4 shrink-0 border-b select-none z-20"
      style={{
        backgroundColor: "var(--bg-canvas)",
        borderColor: "var(--border-hairline)",
      }}
    >
      {/* Left: View Title & Subtitle */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        <h1
          className="text-xs sm:text-sm font-semibold tracking-[-0.02em] whitespace-nowrap"
          style={{ color: "var(--text-primary)" }}
        >
          {viewMeta.title}
        </h1>
        <span
          className="hidden md:inline-block text-[11px] font-normal truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          — {viewMeta.subtitle}
        </span>
      </div>

      {/* Right: Consolidated Global Hardware Cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Hardware Camera Selector Dropdown */}
        <div
          className="relative inline-flex items-center rounded-lg border text-xs"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <Camera
            className="pointer-events-none absolute left-2 w-3.5 h-3.5"
            strokeWidth={1.5}
            style={{ color: "var(--text-secondary)" }}
          />
          <select
            aria-label="Select Camera Hardware"
            value={camera.activeDeviceId ?? ""}
            onChange={(e) => void handleSelectCamera(e.target.value)}
            disabled={camera.isStarting || !cameraEnabled}
            className="pl-7 pr-6 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium rounded-lg text-xs outline-none max-w-[140px] sm:max-w-[190px] truncate disabled:opacity-50 cursor-pointer"
            style={{
              colorScheme: theme === "dark" ? "dark" : "light",
            }}
          >
            {camera.devices.length === 0 && (
              <option
                value=""
                className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                Default Camera
              </option>
            )}
            {camera.devices.map((d) => (
              <option
                key={d.deviceId}
                value={d.deviceId}
                className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                {d.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void camera.refreshDevices()}
            title="Rescan video devices"
            disabled={camera.isStarting}
            className="p-1 pr-1.5 interactive-control disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            <RefreshCw
              className={`w-3 h-3 ${camera.isStarting ? "animate-spin" : ""}`}
              strokeWidth={1.5}
            />
          </button>
        </div>

        {/* Cam On/Off Toggle Button */}
        <button
          type="button"
          onClick={toggleCamera}
          title={cameraEnabled ? "Turn Off Webcam Feed" : "Turn On Webcam Feed"}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium interactive-control"
          style={{
            backgroundColor: cameraEnabled ? "var(--bg-surface)" : "var(--bg-well)",
            borderColor: "var(--border-hairline)",
            color: cameraEnabled ? "var(--text-primary)" : "var(--accent-primary)",
          }}
        >
          {cameraEnabled ? (
            <Camera className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <CameraOff className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          <span className="hidden sm:inline">{cameraEnabled ? "Cam On" : "Cam Off"}</span>
        </button>

        {/* Audio Mute / Unmute */}
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Mute Game Sounds" : "Enable Game Sounds"}
          className="p-1.5 rounded-lg border interactive-control"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-hairline)",
            color: soundEnabled ? "var(--text-primary)" : "var(--text-secondary)",
          }}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <VolumeX className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
        </button>

        {/* Engine Active / Pause Pill */}
        <button
          type="button"
          onClick={toggleTracking}
          title={trackingEnabled ? "Pause Vision Inference" : "Resume Vision Inference"}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium interactive-control"
          style={{
            backgroundColor: trackingEnabled ? "var(--bg-surface)" : "var(--bg-well)",
            borderColor: "var(--border-hairline)",
            color: trackingEnabled ? "var(--status-ready)" : "var(--text-secondary)",
          }}
        >
          {trackingEnabled ? (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--status-ready)" }}
              />
              <span className="hidden md:inline">Engine Active</span>
              <Pause className="w-3 h-3 md:hidden" strokeWidth={1.5} />
            </>
          ) : (
            <>
              <Play className="w-3 h-3" strokeWidth={1.5} />
              <span className="hidden md:inline">Resume</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
