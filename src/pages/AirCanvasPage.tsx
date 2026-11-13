import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CameraState } from "../hooks/useCamera";
import { useAudioFeedback } from "../hooks/useAudioFeedback";
import { platform } from "../platform";
import type { ArtworkMetaDto } from "../platform/types";
import { useAppStore } from "../store/useAppStore";
import { useDrawingStore } from "../store/useDrawingStore";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { AirCanvasWorkspace } from "../components/drawing/AirCanvasWorkspace";
import { DrawingToolbar } from "../components/drawing/DrawingToolbar";

interface AirCanvasPageProps {
  camera: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function AirCanvasPage({ camera, videoRef }: AirCanvasPageProps) {
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [artworks, setArtworks] = useState<ArtworkMetaDto[]>([]);

  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const audio = useAudioFeedback(soundEnabled);

  const artworkId = useDrawingStore((s) => s.artworkId);
  const artworkTitle = useDrawingStore((s) => s.artworkTitle);
  const strokes = useDrawingStore((s) => s.strokes);
  const setArtworkTitle = useDrawingStore((s) => s.setArtworkTitle);
  const loadArtworkData = useDrawingStore((s) => s.loadArtworkData);
  const undo = useDrawingStore((s) => s.undo);
  const redo = useDrawingStore((s) => s.redo);

  const refreshArtworks = useCallback(() => {
    void platform.listArtworks().then(setArtworks).catch(() => {});
  }, []);

  useEffect(() => {
    refreshArtworks();
  }, [refreshArtworks]);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => setStatusToast(null), 2600);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const handleSaveProject = async () => {
    const canvas = committedCanvasRef.current;
    await platform.saveArtwork({
      id: artworkId,
      title: artworkTitle.trim() || "Air Sketch",
      width: canvas?.width ?? 1280,
      height: canvas?.height ?? 720,
      strokes,
      updated_at: Math.floor(Date.now() / 1000),
    });
    refreshArtworks();
    showToast("Saved sketch to local database");
  };

  const handleOpenArtwork = async (id: string) => {
    const art = await platform.loadArtwork(id);
    loadArtworkData(art.id, art.title, art.strokes);
    showToast(`Loaded "${art.title}"`);
  };

  const handleExportSvg = async () => {
    const canvas = committedCanvasRef.current;
    const saved = await platform.exportArtworkSvg(
      artworkTitle.trim() || "Air_Sketch",
      canvas?.width ?? 1280,
      canvas?.height ?? 720,
      strokes,
    );
    if (saved) showToast(`Exported SVG: ${saved}`);
  };

  const handleExportPng = async () => {
    const src = committedCanvasRef.current;
    if (!src) return;

    // Composite onto bright studio white background so exported PNG is crisp and legible
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) return;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const saved = await platform.exportArtworkPng(artworkTitle.trim() || "Air_Sketch", bytes);
    if (saved) showToast(`Exported PNG: ${saved}`);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-canvas)] p-2">
      {camera.error ? (
        <div className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xs">
          <CameraPermissionGuard
            error={camera.error}
            onRetry={() => void camera.startCamera(camera.activeDeviceId)}
          />
        </div>
      ) : (
        <div className="relative flex flex-1 h-full w-full overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xs">
          <AirCanvasWorkspace
            videoRef={videoRef}
            stream={camera.stream}
            committedCanvasRef={committedCanvasRef}
            onDwellAction={() => audio.playClick()}
          />
          <DrawingToolbar
            artworkTitle={artworkTitle}
            setArtworkTitle={setArtworkTitle}
            statusToast={statusToast}
            artworks={artworks}
            onRefreshArtworks={refreshArtworks}
            onOpenArtwork={(id) => void handleOpenArtwork(id)}
            onSaveProject={() => void handleSaveProject()}
            onExportPng={() => void handleExportPng()}
            onExportSvg={() => void handleExportSvg()}
          />
        </div>
      )}
    </div>
  );
}
