import { Camera, CameraOff } from "lucide-react";
import { useEffect, type RefObject } from "react";
import { useAppStore } from "../../store/useAppStore";

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
  mirror: boolean;
  className?: string;
}

export function CameraPreview({
  videoRef,
  stream,
  mirror,
  className = "",
}: CameraPreviewProps) {
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const setCameraEnabled = useAppStore((s) => s.setCameraEnabled);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream && cameraEnabled) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        void el.play().catch(() => {});
      }
    } else if (el.srcObject) {
      el.srcObject = null;
    }
  }, [videoRef, stream, cameraEnabled]);

  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""} ${
          !cameraEnabled ? "opacity-0" : ""
        } ${className}`}
      />
      {!cameraEnabled && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-100/95 p-6 text-center backdrop-blur-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-rose-500 shadow-xs">
            <CameraOff className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Camera is Turned Off</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Your webcam feed is paused and hardware tracks are released.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCameraEnabled(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-sky-500"
          >
            <Camera className="h-3.5 w-3.5" />
            Turn Camera On
          </button>
        </div>
      )}
    </>
  );
}
