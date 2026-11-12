import { useCallback, useEffect, useRef, useState } from "react";

export type CameraErrorKind =
  | "permission_denied"
  | "not_found"
  | "in_use"
  | "unsupported"
  | "unknown";

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
}

export interface CameraState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  streamActive: boolean;
  isStarting: boolean;
  devices: CameraDeviceInfo[];
  activeDeviceId: string | null;
  facingMode: "user" | "environment";
  error: { kind: CameraErrorKind; message: string } | null;
  startCamera: (deviceId?: string | null, facing?: "user" | "environment") => Promise<void>;
  stopCamera: () => void;
  switchFacingMode: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<CameraDeviceInfo[]>;
}

const VIRTUAL_CAMERA_RE = /iriun|obs|virtual|snap camera|manycam|droidcam|epoccam|ndi/i;

function pickPreferredPhysicalCamera(cams: CameraDeviceInfo[]): CameraDeviceInfo | undefined {
  return cams.find((c) => c.deviceId && c.label && !VIRTUAL_CAMERA_RE.test(c.label));
}

function classifyError(err: unknown): { kind: CameraErrorKind; message: string } {
  if (!(err instanceof Error)) {
    return { kind: "unknown", message: "Unexpected camera error occurred." };
  }
  const name = err.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      kind: "permission_denied",
      message: "Camera permission was denied. Allow camera access in your system or browser settings.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: "not_found",
      message: "No camera device was detected on this system.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      kind: "in_use",
      message: "Your camera is already being used by another application (Zoom, Meet, OBS, etc.).",
    };
  }
  return { kind: "unknown", message: err.message || "Failed to initialize camera." };
}

export function useCamera(initialDeviceId?: string | null): CameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(initialDeviceId ?? null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [error, setError] = useState<{ kind: CameraErrorKind; message: string } | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setStreamActive(false);
  }, []);

  const refreshDevices = useCallback(async (): Promise<CameraDeviceInfo[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list
        .filter((d) => d.kind === "videoinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
        }));
      setDevices(cams);
      return cams;
    } catch {
      return [];
    }
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string | null, facing: "user" | "environment" = facingMode) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError({
          kind: "unsupported",
          message: "Camera API is unavailable. Ensure HTTPS or localhost secure context.",
        });
        return;
      }

      stopCamera();
      setIsStarting(true);
      setError(null);

      try {
        let targetDeviceId = deviceId ?? null;
        if (!targetDeviceId) {
          const initialList = await refreshDevices();
          const physical = pickPreferredPhysicalCamera(initialList);
          if (physical) {
            targetDeviceId = physical.deviceId;
          }
        }

        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        };

        if (targetDeviceId) {
          videoConstraints.deviceId = { exact: targetDeviceId };
        } else {
          videoConstraints.facingMode = facing;
        }

        let nextStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        let activeTrack = nextStream.getVideoTracks()[0];
        const enumeratedAfter = await refreshDevices();

        // If OS defaulted to a virtual camera placeholder (e.g. Iriun/OBS) and no explicit deviceId was requested,
        // automatically switch to a physical camera if one is available.
        if (!deviceId && activeTrack && VIRTUAL_CAMERA_RE.test(activeTrack.label)) {
          const physical = pickPreferredPhysicalCamera(enumeratedAfter);
          if (physical && physical.deviceId !== activeTrack.getSettings().deviceId) {
            for (const track of nextStream.getTracks()) track.stop();
            nextStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: physical.deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 60 },
              },
              audio: false,
            });
            activeTrack = nextStream.getVideoTracks()[0];
          }
        }

        streamRef.current = nextStream;
        setStream(nextStream);
        const settings = activeTrack?.getSettings();
        if (settings?.deviceId) {
          setActiveDeviceId(settings.deviceId);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
          await videoRef.current.play();
        }
        setStreamActive(true);
      } catch (err) {
        // Fallback if exact deviceId is disconnected
        if (deviceId) {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
            streamRef.current = fallbackStream;
            setStream(fallbackStream);
            const fallbackId = fallbackStream.getVideoTracks()[0]?.getSettings().deviceId;
            if (fallbackId) setActiveDeviceId(fallbackId);
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              await videoRef.current.play();
            }
            setStreamActive(true);
            await refreshDevices();
            return;
          } catch (fallbackErr) {
            setError(classifyError(fallbackErr));
            return;
          }
        }
        setError(classifyError(err));
      } finally {
        setIsStarting(false);
      }
    },
    [facingMode, refreshDevices, stopCamera],
  );

  const switchFacingMode = useCallback(async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await startCamera(null, next);
  }, [facingMode, startCamera]);

  const selectDevice = useCallback(
    async (deviceId: string) => {
      setActiveDeviceId(deviceId);
      await startCamera(deviceId, facingMode);
    },
    [facingMode, startCamera],
  );

  useEffect(() => {
    void refreshDevices();
    const mediaDevices = navigator.mediaDevices;
    const onDeviceChange = () => {
      void refreshDevices();
    };
    mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => {
      mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      stopCamera();
    };
  }, [refreshDevices, stopCamera]);

  return {
    videoRef,
    stream,
    streamActive,
    isStarting,
    devices,
    activeDeviceId,
    facingMode,
    error,
    startCamera,
    stopCamera,
    switchFacingMode,
    selectDevice,
    refreshDevices,
  };
}
