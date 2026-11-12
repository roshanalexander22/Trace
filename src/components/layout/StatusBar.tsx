import { AlertTriangle, Cpu, Activity, HardDrive } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

const FINGER_LABELS = ["T", "I", "M", "R", "P"];

export function StatusBar() {
  const live = useAppStore((s) => s.live);
  const visionReady = useAppStore((s) => s.visionReady);
  const visionError = useAppStore((s) => s.visionError);
  const trackingEnabled = useAppStore((s) => s.trackingEnabled);
  const sys = useAppStore((s) => s.systemTelemetry);

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-white/90 px-4 py-2 text-xs text-slate-600 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              visionError
                ? "bg-rose-500"
                : !trackingEnabled
                  ? "bg-amber-500"
                  : visionReady
                    ? live.detected
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]"
                      : "bg-sky-500"
                    : "bg-slate-400 animate-pulse"
            }`}
          />
          <span className={`font-medium ${visionError ? "text-rose-600" : "text-slate-800"}`}>
            {visionError
              ? `AI Error: ${visionError}`
              : !trackingEnabled
                ? "Paused (Ctrl+Shift+T)"
                : !visionReady
                  ? "Loading AI..."
                  : live.detected
                    ? `Hand: ${live.stableGesture}`
                    : "Waiting for hand"}
          </span>
        </span>

        {live.detected && (
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px]">
            {live.fingerBitmask.map((up, i) => (
              <span
                key={FINGER_LABELS[i]}
                className={up ? "font-bold text-sky-600" : "text-slate-400"}
              >
                {FINGER_LABELS[i]}
              </span>
            ))}
          </div>
        )}

        {live.lowLightWarning && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Low confidence / lighting
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 font-mono text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Activity className="h-3.5 w-3.5 text-sky-600" />
          {live.fps} FPS ({live.inferenceMs.toFixed(1)} ms)
        </span>
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5 text-indigo-600" />
          {live.activeDelegate}
        </span>
        {sys.memory_mb > 0 && (
          <span className="inline-flex items-center gap-1">
            <HardDrive className="h-3.5 w-3.5 text-emerald-600" />
            {sys.memory_mb.toFixed(1)} MB
          </span>
        )}
      </div>
    </footer>
  );
}

