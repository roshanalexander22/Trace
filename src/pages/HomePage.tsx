import {
  ArrowRight,
  Eye,
  EyeOff,
  FlipHorizontal,
  FolderOpen,
  Paintbrush,
  Ratio,
  Split as SplitIcon,
  Swords,
  Trophy,
} from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { CameraPreview } from "../components/vision/CameraPreview";
import { HandSkeletonOverlay } from "../components/vision/HandSkeletonOverlay";
import type { CameraState } from "../hooks/useCamera";
import { platform } from "../platform";
import type { ArtworkMetaDto } from "../platform/types";
import { useAppStore } from "../store/useAppStore";
import { useDrawingStore } from "../store/useDrawingStore";

interface HomePageProps {
  camera: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function HomePage({ camera, videoRef }: HomePageProps) {
  const setMode = useAppStore((s) => s.setMode);
  const mirror = useAppStore((s) => s.calibration.mirror_feed);
  const patchCalibration = useAppStore((s) => s.patchCalibration);
  const live = useAppStore((s) => s.live);
  const visionReady = useAppStore((s) => s.visionReady);
  const visionError = useAppStore((s) => s.visionError);
  const cameraFit = useAppStore((s) => s.cameraFit);
  const toggleCameraFit = useAppStore((s) => s.toggleCameraFit);
  const loadArtworkData = useDrawingStore((s) => s.loadArtworkData);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [artworks, setArtworks] = useState<ArtworkMetaDto[]>([]);

  useEffect(() => {
    void platform.listArtworks().then(setArtworks).catch(() => {});
  }, []);

  const handleOpenArtwork = async (id: string) => {
    const art = await platform.loadArtwork(id);
    loadArtworkData(art.id, art.title, art.strokes);
    setMode("canvas");
  };

  const toggleMirror = () => {
    patchCalibration({ mirror_feed: !mirror });
  };

  return (
    <div
      className="h-full w-full overflow-y-auto p-4 sm:p-6"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      <div className="mx-auto max-w-7xl h-full grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
        {/* Left 60%: Workspace Launcher (2x2 Grid) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-[-0.02em]">
                Workspace Launcher
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Select a game arena or open the tactile air-drawing canvas.
              </p>
            </div>
          </div>

          {/* 2x2 Equal-Height Launcher Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* 1. RPS Arena */}
            <button
              type="button"
              onClick={() => setMode("rps")}
              className="group relative flex flex-col justify-between p-4 rounded-xl border text-left interactive-control"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Swords className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wider uppercase telemetry-value px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Arena
                  </span>
                </div>

                {/* Minimalist Vector Gesture Diagram */}
                <div className="my-3 flex items-center justify-center h-16 rounded-lg bg-[var(--bg-well)]/40 overflow-hidden">
                  <svg
                    viewBox="0 0 160 50"
                    className="h-10 w-36 stroke-[var(--text-secondary)] fill-none transition-transform duration-300 group-hover:scale-105"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Fist (Rock) */}
                    <g transform="translate(14, 5)">
                      <rect x="0" y="8" width="22" height="26" rx="6" />
                      <path d="M4 14 h14 M4 20 h14 M4 26 h14" />
                    </g>
                    {/* Palm (Paper) */}
                    <g transform="translate(68, 4)">
                      <rect x="3" y="16" width="18" height="18" rx="4" />
                      <path d="M4 16 V4 a2 2 0 0 1 4 0 v12" />
                      <path d="M8 16 V1 a2 2 0 0 1 4 0 v15" />
                      <path d="M12 16 V3 a2 2 0 0 1 4 0 v13" />
                      <path d="M16 16 V7 a2 2 0 0 1 4 0 v9" />
                    </g>
                    {/* Scissors */}
                    <g transform="translate(122, 4)">
                      <rect x="2" y="18" width="18" height="16" rx="4" />
                      <path d="M6 18 V2 a2 2 0 0 1 4 0 v16" />
                      <path d="M12 18 V4 a2 2 0 0 1 4 0 v14" />
                    </g>
                  </svg>
                </div>

                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  Rock Paper Scissors
                </h3>
                <p
                  className="mt-0.5 text-xs line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  3-2-1 animated showdown with realistic AI hand gestures and fair commit-reveal verification.
                </p>
              </div>

              <div
                className="mt-3.5 flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--accent-primary)" }}
              >
                <span>Enter Arena</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </div>
            </button>

            {/* 2. Split (Chopsticks) */}
            <button
              type="button"
              onClick={() => setMode("split")}
              className="group relative flex flex-col justify-between p-4 rounded-xl border text-left interactive-control"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <SplitIcon className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wider uppercase telemetry-value px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Tactile
                  </span>
                </div>

                {/* Minimalist Vector Diagram */}
                <div className="my-3 flex items-center justify-center h-16 rounded-lg bg-[var(--bg-well)]/40 overflow-hidden">
                  <svg
                    viewBox="0 0 140 50"
                    className="h-10 w-32 stroke-[var(--text-secondary)] fill-none transition-transform duration-300 group-hover:scale-105"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Left hand (1 finger) */}
                    <g transform="translate(24, 6)">
                      <rect x="2" y="16" width="16" height="16" rx="4" />
                      <path d="M6 16 V2 a2 2 0 0 1 4 0 v14" />
                    </g>
                    {/* Attack line */}
                    <path d="M52 24 L86 24" strokeDasharray="3 3" />
                    {/* Right hand (2 fingers) */}
                    <g transform="translate(94, 6)">
                      <rect x="2" y="16" width="16" height="16" rx="4" />
                      <path d="M5 16 V4 a2 2 0 0 1 4 0 v12" />
                      <path d="M11 16 V2 a2 2 0 0 1 4 0 v14" />
                    </g>
                  </svg>
                </div>

                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  Split (Chopsticks)
                </h3>
                <p
                  className="mt-0.5 text-xs line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Reach up to physically tap AI hands, eliminate with exact 5, rollover over 5, or clap palms to split.
                </p>
              </div>

              <div
                className="mt-3.5 flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--accent-primary)" }}
              >
                <span>Play Split</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </div>
            </button>

            {/* 3. Hand Cricket */}
            <button
              type="button"
              onClick={() => setMode("cricket")}
              className="group relative flex flex-col justify-between p-4 rounded-xl border text-left interactive-control"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Trophy className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wider uppercase telemetry-value px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    0–6
                  </span>
                </div>

                {/* Minimalist Vector Diagram */}
                <div className="my-3 flex items-center justify-center h-16 rounded-lg bg-[var(--bg-well)]/40 overflow-hidden">
                  <svg
                    viewBox="0 0 140 50"
                    className="h-10 w-32 stroke-[var(--text-secondary)] fill-none transition-transform duration-300 group-hover:scale-105"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Bat */}
                    <path d="M22 38 L40 10 L48 14 L30 42 Z" />
                    <path d="M40 10 L46 2" />
                    {/* Cricket ball */}
                    <circle cx="70" cy="24" r="7" />
                    <path d="M64 24 Q70 19 76 24" />
                    {/* Sixer (Thumb up) */}
                    <g transform="translate(94, 6)">
                      <rect x="2" y="16" width="16" height="16" rx="4" />
                      <path d="M6 16 V2 a2.5 2.5 0 0 1 5 0 v14" />
                    </g>
                  </svg>
                </div>

                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  Hand Cricket
                </h3>
                <p
                  className="mt-0.5 text-xs line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Classic 0–6 batsman vs bowler showdown with Odd/Even toss, fair AI prediction, and chase target.
                </p>
              </div>

              <div
                className="mt-3.5 flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--accent-primary)" }}
              >
                <span>Play Cricket</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </div>
            </button>

            {/* 4. Air Canvas */}
            <button
              type="button"
              onClick={() => setMode("canvas")}
              className="group relative flex flex-col justify-between p-4 rounded-xl border text-left interactive-control"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Paintbrush className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wider uppercase telemetry-value px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Studio
                  </span>
                </div>

                {/* Minimalist Vector Diagram */}
                <div className="my-3 flex items-center justify-center h-16 rounded-lg bg-[var(--bg-well)]/40 overflow-hidden">
                  <svg
                    viewBox="0 0 140 50"
                    className="h-10 w-32 stroke-[var(--text-secondary)] fill-none transition-transform duration-300 group-hover:scale-105"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Stylus spline */}
                    <path d="M18 36 C38 12, 60 40, 88 18 S122 30, 126 14" />
                    {/* Index pointer */}
                    <circle cx="126" cy="14" r="3.5" fill="var(--text-secondary)" />
                  </svg>
                </div>

                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  Air Canvas
                </h3>
                <p
                  className="mt-0.5 text-xs line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Mid-air vector drawing workspace with 1-Euro spline smoothing, brush tools, and SVG/PNG export.
                </p>
              </div>

              <div
                className="mt-3.5 flex items-center gap-1 text-xs font-semibold"
                style={{ color: "var(--accent-primary)" }}
              >
                <span>Open Canvas</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
              </div>
            </button>
          </div>

          {/* Quick-open saved sketches */}
          {artworks.length > 0 && (
            <div
              className="p-3 rounded-xl border"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div
                className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: "var(--text-secondary)" }}
              >
                <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Recent Studio Sketches</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {artworks.slice(0, 6).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => void handleOpenArtwork(a.id)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium interactive-control"
                    style={{
                      backgroundColor: "var(--bg-well)",
                      borderColor: "var(--border-hairline)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {a.title}{" "}
                    <span className="telemetry-value text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      ({a.stroke_count})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 40%: Live Sensor Preview */}
        <div
          className="relative flex flex-col rounded-2xl border overflow-hidden shadow-sm"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-hairline)",
            minHeight: "360px",
          }}
        >
          {/* Video Container */}
          <div className="relative flex-1 w-full overflow-hidden" style={{ backgroundColor: "var(--bg-well)" }}>
            {camera.error ? (
              <CameraPermissionGuard
                error={camera.error}
                onRetry={() => void camera.startCamera(camera.activeDeviceId)}
              />
            ) : (
              <>
                <CameraPreview videoRef={videoRef} stream={camera.stream} mirror={mirror} fit={cameraFit} />
                {showSkeleton && <HandSkeletonOverlay showBadges fit={cameraFit} />}
              </>
            )}

            {/* Top-Right Tucked Glass Controls (Mirror + Fit + Skeleton Toggles) */}
            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMirror}
                title={mirror ? "Mirror is ON (Flip Horizontal)" : "Mirror is OFF"}
                className="p-1.5 rounded-lg border text-xs backdrop-blur-md interactive-control"
                style={{
                  backgroundColor: mirror ? "var(--bg-surface)" : "var(--bg-well)",
                  borderColor: "var(--border-hairline)",
                  color: mirror ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                <FlipHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>

              <button
                type="button"
                onClick={toggleCameraFit}
                title={`Aspect Fit: currently ${cameraFit === "cover" ? "Cover (Fill Container)" : "Contain (Letterbox)"}. Click to toggle.`}
                className="p-1.5 rounded-lg border text-xs backdrop-blur-md interactive-control"
                style={{
                  backgroundColor: cameraFit === "contain" ? "var(--bg-surface)" : "var(--bg-well)",
                  borderColor: "var(--border-hairline)",
                  color: cameraFit === "contain" ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                <Ratio className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>

              <button
                type="button"
                onClick={() => setShowSkeleton((v) => !v)}
                title={showSkeleton ? "Hide Skeleton Overlay" : "Show Skeleton Overlay"}
                className="p-1.5 rounded-lg border text-xs backdrop-blur-md interactive-control"
                style={{
                  backgroundColor: showSkeleton ? "var(--bg-surface)" : "var(--bg-well)",
                  borderColor: "var(--border-hairline)",
                  color: showSkeleton ? "var(--status-ready)" : "var(--text-secondary)",
                }}
              >
                {showSkeleton ? (
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
              </button>
            </div>

            {/* Bottom-Left Status Pill */}
            <div
              className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium backdrop-blur-md"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-primary)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: visionError
                    ? "var(--accent-primary)"
                    : live.detected
                      ? "var(--status-ready)"
                      : "var(--text-secondary)",
                }}
              />
              <span>
                {visionError
                  ? "Vision Error"
                  : visionReady
                    ? live.detected
                      ? `Detected: ${live.stableGesture}`
                      : "Sensor Active"
                    : "Initializing..."}
              </span>
            </div>

            {/* Bottom-Right Telemetry Pill */}
            <div
              className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-1 rounded-lg border telemetry-value text-[10px] font-medium backdrop-blur-md"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-secondary)",
              }}
            >
              <span>{live.fps} FPS</span>
              <span>·</span>
              <span>{live.inferenceMs.toFixed(1)}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
