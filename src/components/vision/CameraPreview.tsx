import { Camera, CameraOff } from "lucide-react";
import { useEffect, type RefObject } from "react";
import { useAppStore } from "../../store/useAppStore";

interface CameraPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
  mirror: boolean;
  className?: string;
  fit?: "cover" | "contain";
}

export function CameraPreview({
  videoRef,
  stream,
  mirror,
  className = "",
  fit,
}: CameraPreviewProps) {
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const setCameraEnabled = useAppStore((s) => s.setCameraEnabled);
  const storeCameraFit = useAppStore((s) => s.cameraFit);
  const effectiveFit = fit ?? storeCameraFit;

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
        className={`h-full w-full ${effectiveFit === "contain" ? "object-contain" : "object-cover"} ${
          mirror ? "-scale-x-100" : ""
        } ${!cameraEnabled ? "opacity-0" : ""} ${className}`}
      />
      {!cameraEnabled && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center backdrop-blur-md"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-xs"
            style={{
              backgroundColor: "var(--bg-well)",
              borderColor: "var(--border-hairline)",
              color: "var(--accent-primary)",
            }}
          >
            <CameraOff className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Camera is Turned Off
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              Your webcam feed is paused and hardware tracks are released.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCameraEnabled(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs interactive-control"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-contrast)",
            }}
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={1.5} />
            Turn Camera On
          </button>
        </div>
      )}
    </>
  );
}
