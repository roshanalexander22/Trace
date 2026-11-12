import { ArrowRight, CheckCircle2, FolderOpen, Paintbrush, Sparkles, Swords } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import type { CameraState } from "../hooks/useCamera";
import { platform } from "../platform";
import type { ArtworkMetaDto } from "../platform/types";
import { useAppStore } from "../store/useAppStore";
import { useDrawingStore } from "../store/useDrawingStore";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { CameraPreview } from "../components/vision/CameraPreview";
import { CameraSelector } from "../components/vision/CameraSelector";
import { HandSkeletonOverlay } from "../components/vision/HandSkeletonOverlay";

interface HomePageProps {
  camera: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function HomePage({ camera, videoRef }: HomePageProps) {
  const setMode = useAppStore((s) => s.setMode);
  const mirror = useAppStore((s) => s.calibration.mirror_feed);
  const live = useAppStore((s) => s.live);
  const visionReady = useAppStore((s) => s.visionReady);
  const visionError = useAppStore((s) => s.visionError);
  const loadArtworkData = useDrawingStore((s) => s.loadArtworkData);

  const [artworks, setArtworks] = useState<ArtworkMetaDto[]>([]);

  useEffect(() => {
    void platform.listArtworks().then(setArtworks).catch(() => {});
  }, []);

  const handleOpenArtwork = async (id: string) => {
    const art = await platform.loadArtwork(id);
    loadArtworkData(art.id, art.title, art.strokes);
    setMode("canvas");
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Left: Hero & Mode Cards */}
        <div className="flex flex-col justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              100% Local Computer Vision • Zero Cloud Video
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Your AI Hand Companion
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Powered by a dual-target Rust geometry engine and offline MediaPipe tracking. Play
              provably fair Rock Paper Scissors against an animated AI hand or sketch vector art in
              mid-air.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setMode("rps")}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Swords className="h-5 w-5" />
                </div>
                <h2 className="mt-3 text-base font-bold text-slate-900">AI Rock Paper Scissors</h2>
                <p className="mt-1 text-xs text-slate-600">
                  3-2-1 animated showdown with cryptographic commit-reveal fairness and persistent
                  match history.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 transition group-hover:translate-x-0.5">
                Enter Arena <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              onClick={() => setMode("canvas")}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Paintbrush className="h-5 w-5" />
                </div>
                <h2 className="mt-3 text-base font-bold text-slate-900">Air Drawing Studio</h2>
                <p className="mt-1 text-xs text-slate-600">
                  1-Euro smoothed fingertip ink, Peace-hover tool picking, and native SVG/PNG
                  exports.
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition group-hover:translate-x-0.5">
                Open Canvas <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>

          {artworks.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xs">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <FolderOpen className="h-3.5 w-3.5" />
                Saved Air Sketches
              </div>
              <div className="flex flex-wrap gap-2">
                {artworks.slice(0, 6).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => void handleOpenArtwork(a.id)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {a.title} <span className="text-slate-400">({a.stroke_count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Camera & Landmark Verification Card */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-800">
              Live Hand Tracking Preview
            </span>
            <div className="flex items-center gap-3">
              <CameraSelector camera={camera} compact />
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  visionError ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {visionError
                  ? "Vision Error"
                  : visionReady
                    ? live.detected
                      ? live.stableGesture
                      : "Model Ready"
                    : "Initializing..."}
              </span>
            </div>
          </div>

          <div className="relative aspect-video w-full flex-1 bg-slate-100">
            {camera.error ? (
              <CameraPermissionGuard
                error={camera.error}
                onRetry={() => void camera.startCamera(camera.activeDeviceId)}
              />
            ) : (
              <>
                <CameraPreview videoRef={videoRef} stream={camera.stream} mirror={mirror} />
                <HandSkeletonOverlay />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
