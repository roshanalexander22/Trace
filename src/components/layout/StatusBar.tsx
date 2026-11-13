import { AlertTriangle } from "lucide-react";
import { formatGpuShort } from "../../platform/gpuFormatter";
import { platform } from "../../platform";
import { useAppStore } from "../../store/useAppStore";
import { workerClient } from "../../vision/workerClient";

const FINGER_LABELS = ["T", "I", "M", "R", "P"];

export function StatusBar() {
  const live = useAppStore((s) => s.live);
  const calibration = useAppStore((s) => s.calibration);
  const patchCalibration = useAppStore((s) => s.patchCalibration);
  const visionReady = useAppStore((s) => s.visionReady);
  const visionError = useAppStore((s) => s.visionError);
  const trackingEnabled = useAppStore((s) => s.trackingEnabled);
  const sys = useAppStore((s) => s.systemTelemetry);

  return (
    <footer
      className="flex items-center justify-between h-[26px] px-3 shrink-0 border-t select-none z-20 text-[11px]"
      style={{
        backgroundColor: "var(--bg-canvas)",
        borderColor: "var(--border-hairline)",
        color: "var(--text-secondary)",
      }}
    >
      {/* Left: Gesture State & Bitmask */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="inline-flex items-center gap-1.5 font-medium truncate">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: visionError
                ? "var(--accent-primary)"
                : !trackingEnabled
                  ? "var(--text-secondary)"
                  : visionReady
                    ? live.detected
                      ? "var(--status-ready)"
                      : "var(--text-secondary)"
                    : "var(--text-secondary)",
              opacity: live.detected ? 1 : 0.6,
            }}
          />
          <span
            style={{
              color: visionError
                ? "var(--accent-primary)"
                : live.detected
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            {visionError
              ? `AI Error: ${visionError}`
              : !trackingEnabled
                ? "Engine Paused"
                : !visionReady
                  ? "Loading Engine..."
                  : live.detected
                    ? `Hand: ${live.stableGesture}`
                    : "Waiting for hand"}
          </span>
        </span>

        {live.detected && (
          <div
            className="hidden sm:flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] border"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-hairline)",
            }}
          >
            {live.fingerBitmask.map((up, i) => (
              <span
                key={FINGER_LABELS[i]}
                style={{
                  color: up ? "var(--accent-primary)" : "var(--text-secondary)",
                  opacity: up ? 1 : 0.35,
                  fontWeight: up ? 700 : 400,
                }}
              >
                {FINGER_LABELS[i]}
              </span>
            ))}
          </div>
        )}

        {live.lowLightWarning && (
          <span
            className="hidden md:inline-flex items-center gap-1 px-2 py-0.2 rounded text-[10px] border"
            style={{
              backgroundColor: "var(--bg-well)",
              borderColor: "var(--border-hairline)",
              color: "var(--accent-primary)",
            }}
          >
            <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
            Low Lighting
          </span>
        )}
      </div>

      {/* Right: Monospace Tabular Telemetry (Zero Jitter) */}
      <div className="flex items-center gap-3 telemetry-value text-[11px] font-medium whitespace-nowrap">
        <button
          type="button"
          onClick={() => workerClient.refreshEngine()}
          title="Click to manually refresh Vision Engine"
          className="hover:text-[var(--text-primary)] transition cursor-pointer"
        >
          {live.fps} FPS <span style={{ opacity: 0.5 }}>·</span> {live.inferenceMs.toFixed(1)} ms
        </button>
        <span style={{ opacity: 0.5 }}>·</span>
        <button
          type="button"
          onClick={() => {
            const current = (calibration.delegate || "GPU").toUpperCase();
            const next = current === "CPU" ? "GPU" : "CPU";
            patchCalibration({ delegate: next });
            void platform.saveCalibration({ ...calibration, delegate: next }).catch(() => {});
            if (next !== "CPU") {
              void platform.setGpuPreference(next).catch(() => {});
            }
          }}
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider px-2 py-0.5 rounded border text-[10px] interactive-control cursor-pointer hover:bg-[var(--bg-well)] hover:text-[var(--text-primary)] transition"
          style={{
            borderColor: "var(--border-hairline)",
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
          title={`Active Hardware: ${live.rendererName || live.activeDelegate}. Click to switch between ${formatGpuShort(live.rendererName)} and CPU SIMD`}
        >
          {live.activeDelegate === "CPU" ? "CPU SIMD" : formatGpuShort(live.rendererName)}
        </button>
        {sys.memory_mb > 0 && (
          <>
            <span className="hidden sm:inline" style={{ opacity: 0.5 }}>·</span>
            <span className="hidden sm:inline">{sys.memory_mb.toFixed(1)} MB</span>
          </>
        )}
      </div>
    </footer>
  );
}

