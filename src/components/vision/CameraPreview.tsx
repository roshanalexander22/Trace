import { useEffect, type RefObject } from "react";

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
  useEffect(() => {
    const el = videoRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
  }, [videoRef, stream]);

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      autoPlay
      className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""} ${className}`}
    />
  );
}
