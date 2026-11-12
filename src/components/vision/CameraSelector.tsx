import { Camera, RefreshCw } from "lucide-react";
import type { CameraState } from "../../hooks/useCamera";
import { platform } from "../../platform";
import { useAppStore } from "../../store/useAppStore";

interface CameraSelectorProps {
  camera: CameraState;
  compact?: boolean;
}

export function CameraSelector({ camera, compact = false }: CameraSelectorProps) {
  const patchCalibration = useAppStore((s) => s.patchCalibration);

  const handleSelect = async (id: string) => {
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
    <div className="inline-flex items-center gap-1.5">
      <div className="relative inline-flex items-center">
        <Camera className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-sky-600" />
        <select
          aria-label="Select Camera"
          value={camera.activeDeviceId ?? ""}
          onChange={(e) => void handleSelect(e.target.value)}
          disabled={camera.isStarting}
          className={`rounded-xl border border-slate-200 bg-white pl-8 pr-7 font-medium text-slate-800 shadow-2xs outline-none transition hover:border-slate-300 focus:border-sky-500 disabled:opacity-60 ${
            compact ? "max-w-[190px] py-1 text-xs" : "w-full py-2 text-xs"
          }`}
        >
          {camera.devices.length === 0 && <option value="">Default Camera</option>}
          {camera.devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => void camera.refreshDevices()}
        title="Rescan available cameras"
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${camera.isStarting ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

