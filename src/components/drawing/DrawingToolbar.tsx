import {
  Circle,
  Download,
  Droplets,
  Eraser,
  Eye,
  FileImage,
  FilePlus2,
  FolderOpen,
  Grid3x3,
  Highlighter,
  Minus,
  Paintbrush,
  Redo2,
  Save,
  SlidersHorizontal,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ArtworkMetaDto } from "../../platform/types";
import {
  PALETTE_COLORS,
  useDrawingStore,
  type BackgroundPattern,
  type CameraOpacityMode,
  type DrawingTool,
} from "../../store/useDrawingStore";

interface DrawingToolbarProps {
  artworkTitle: string;
  setArtworkTitle: (t: string) => void;
  statusToast: string | null;
  artworks: ArtworkMetaDto[];
  onRefreshArtworks: () => void;
  onOpenArtwork: (id: string) => void;
  onSaveProject: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
}

const TOOLS: Array<{ id: DrawingTool; label: string; icon: typeof Paintbrush }> = [
  { id: "pen", label: "Pen", icon: Paintbrush },
  { id: "highlighter", label: "Marker", icon: Highlighter },
  { id: "spray", label: "Airbrush", icon: Droplets },
  { id: "line", label: "Line", icon: Minus },
  { id: "rect", label: "Rect", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

const CAMERA_MODES: Array<{ id: CameraOpacityMode; label: string }> = [
  { id: "overlay", label: "Camera" },
  { id: "pip", label: "PiP" },
  { id: "hidden", label: "Board" },
];

const PATTERNS: Array<{ id: BackgroundPattern; label: string }> = [
  { id: "none", label: "Plain" },
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
];

export function DrawingToolbar({
  artworkTitle,
  setArtworkTitle,
  statusToast,
  artworks,
  onRefreshArtworks,
  onOpenArtwork,
  onSaveProject,
  onExportPng,
  onExportSvg,
}: DrawingToolbarProps) {
  const [showSavedMenu, setShowSavedMenu] = useState(false);
  const [showBrushPopover, setShowBrushPopover] = useState(false);

  const tool = useDrawingStore((s) => s.tool);
  const color = useDrawingStore((s) => s.color);
  const brushWidth = useDrawingStore((s) => s.brushWidth);
  const strokeOpacity = useDrawingStore((s) => s.strokeOpacity);
  const boardOpacity = useDrawingStore((s) => s.boardOpacity);
  const backgroundPattern = useDrawingStore((s) => s.backgroundPattern);
  const cameraMode = useDrawingStore((s) => s.cameraMode);
  const strokesCount = useDrawingStore((s) => s.strokes.length);
  const redoCount = useDrawingStore((s) => s.redoStack.length);
  const dwellToolbar = useDrawingStore((s) => s.dwellToolbar);

  const setTool = useDrawingStore((s) => s.setTool);
  const setColor = useDrawingStore((s) => s.setColor);
  const setBrushWidth = useDrawingStore((s) => s.setBrushWidth);
  const setStrokeOpacity = useDrawingStore((s) => s.setStrokeOpacity);
  const setBoardOpacity = useDrawingStore((s) => s.setBoardOpacity);
  const setBackgroundPattern = useDrawingStore((s) => s.setBackgroundPattern);
  const setCameraMode = useDrawingStore((s) => s.setCameraMode);
  const setDwellToolbar = useDrawingStore((s) => s.setDwellToolbar);
  const undo = useDrawingStore((s) => s.undo);
  const redo = useDrawingStore((s) => s.redo);
  const clear = useDrawingStore((s) => s.clear);
  const newArtwork = useDrawingStore((s) => s.newArtwork);

  return (
    <>
      {/* 1. TOP FLOATING PILL BAR */}
      <header className="pointer-events-auto absolute left-4 right-4 top-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-3 py-1.5 shadow-sm backdrop-blur-md">
        {/* Left: Editable Title & Status Toast */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={artworkTitle}
            onChange={(e) => setArtworkTitle(e.target.value)}
            aria-label="Artwork Title"
            className="w-36 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)] md:w-48"
            placeholder="Air Sketch"
          />
          {statusToast && (
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {statusToast}
            </span>
          )}
        </div>

        {/* Center: History & Patterns & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* History */}
          <div className="flex items-center gap-1 border-r border-[var(--border-hairline)] pr-2">
            <button
              data-dwell-id="action-undo"
              onClick={undo}
              disabled={strokesCount === 0}
              title="Undo (Ctrl+Z)"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-well)] hover:text-[var(--text-primary)] disabled:opacity-30"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              data-dwell-id="action-redo"
              onClick={redo}
              disabled={redoCount === 0}
              title="Redo (Ctrl+Y)"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-well)] hover:text-[var(--text-primary)] disabled:opacity-30"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <button
              data-dwell-id="action-clear"
              onClick={clear}
              disabled={strokesCount === 0}
              title="Clear Canvas"
              className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Grid pattern segmented */}
          <div className="hidden items-center gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-well)] p-0.5 text-[11px] sm:flex">
            <Grid3x3 className="mx-1 h-3 w-3 text-[var(--text-secondary)]" />
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => setBackgroundPattern(p.id)}
                className={`rounded-md px-1.5 py-0.5 font-medium transition ${
                  backgroundPattern === p.id
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Camera View Mode */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-well)] p-0.5 text-[11px]">
            <Eye className="mx-1 h-3 w-3 text-[var(--text-secondary)]" />
            {CAMERA_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setCameraMode(m.id)}
                className={`rounded-md px-1.5 py-0.5 font-medium transition ${
                  cameraMode === m.id
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xs font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Dwell Toggle */}
          <button
            onClick={() => setDwellToolbar(!dwellToolbar)}
            className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${
              dwellToolbar
                ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-primary)] font-semibold"
                : "border-[var(--border-hairline)] bg-[var(--bg-well)] text-[var(--text-secondary)]"
            }`}
            title="Hover peace sign over tools to select them"
          >
            Dwell {dwellToolbar ? "ON" : "OFF"}
          </button>
        </div>

        {/* Right: Project Management & Export */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={newArtwork}
            title="New Blank Canvas"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-well)]"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>

          <div className="relative">
            <button
              onClick={() => {
                onRefreshArtworks();
                setShowSavedMenu((v) => !v);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-well)]"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open</span>
            </button>

            {showSavedMenu && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 shadow-xl">
                <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <span>Saved Sketches</span>
                  <button
                    onClick={() => setShowSavedMenu(false)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {artworks.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-[var(--text-secondary)]">
                    No saved sketches yet.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-1 overflow-y-auto">
                    {artworks.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          onOpenArtwork(a.id);
                          setShowSavedMenu(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-primary)]"
                      >
                        <span className="truncate font-medium">{a.title}</span>
                        <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                          {a.stroke_count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onSaveProject}
            disabled={strokesCount === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-well)] disabled:opacity-30"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            onClick={onExportPng}
            disabled={strokesCount === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-well)] disabled:opacity-30"
          >
            <FileImage className="h-3.5 w-3.5" />
            <span>PNG</span>
          </button>

          <button
            onClick={onExportSvg}
            disabled={strokesCount === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:opacity-90 disabled:opacity-30"
          >
            <Download className="h-3.5 w-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </header>

      {/* 2. LEFT FLOATING VERTICAL DOCK */}
      <aside className="pointer-events-auto absolute left-4 top-16 z-30 flex flex-col items-center gap-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 p-1.5 shadow-md backdrop-blur-md">
        {/* Tool Buttons */}
        {TOOLS.map(({ id, label, icon: Icon }) => {
          const active = tool === id;
          return (
            <button
              key={id}
              data-dwell-id={`tool-${id}`}
              onClick={() => setTool(id)}
              title={label}
              className={`relative flex h-8 w-8 items-center justify-center rounded-xl transition ${
                active
                  ? id === "eraser"
                    ? "bg-rose-500 text-white shadow-xs"
                    : "bg-[var(--accent-primary)] text-white shadow-xs"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-well)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-1 h-[1px] w-6 bg-[var(--border-hairline)]" />

        {/* Sliders Popover Trigger */}
        <button
          onClick={() => setShowBrushPopover((v) => !v)}
          title="Adjust Brush Size, Ink & Board Opacity"
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
            showBrushPopover
              ? "bg-[var(--accent-subtle)] text-[var(--accent-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-well)] hover:text-[var(--text-primary)]"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="my-1 h-[1px] w-6 bg-[var(--border-hairline)]" />

        {/* Vertical Color Swatches */}
        <div className="flex flex-col items-center gap-1.5">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              data-dwell-id={`color-${c}`}
              onClick={() => setColor(c)}
              title={`Color ${c}`}
              className={`h-5 w-5 rounded-full border transition ${
                tool !== "eraser" && color === c
                  ? "scale-115 border-[var(--text-primary)] ring-2 ring-[var(--accent-primary)]/40"
                  : "border-black/10 hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Custom Color Wheel */}
          <label
            title="Custom Color"
            className="relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black/15 shadow-2xs"
            style={{
              background: "conic-gradient(#ef4444,#eab308,#22c55e,#0ea5e9,#8b5cf6,#ef4444)",
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Custom Color Picker"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </aside>

      {/* 3. COLLAPSIBLE BRUSH POPOVER */}
      {showBrushPopover && (
        <div className="pointer-events-auto absolute left-16 top-36 z-40 w-56 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 shadow-xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
            <span>Stroke & Board Settings</span>
            <button
              onClick={() => setShowBrushPopover(false)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {/* Brush Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-[var(--text-secondary)]">Brush Size</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                  {brushWidth}px
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={48}
                step={1}
                value={brushWidth}
                onChange={(e) => setBrushWidth(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            {/* Ink Opacity */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-[var(--text-secondary)]">Ink Opacity</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                  {Math.round(strokeOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(strokeOpacity * 100)}
                onChange={(e) => setStrokeOpacity(Number(e.target.value) / 100)}
                className="w-full accent-[var(--accent-primary)]"
              />
            </div>

            {/* Board Opacity */}
            <div className="space-y-1 border-t border-[var(--border-hairline)] pt-2">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-[var(--accent-primary)]">Board Backdrop</span>
                <span className="font-mono font-semibold tabular-nums text-[var(--accent-primary)]">
                  {Math.round(boardOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(boardOpacity * 100)}
                onChange={(e) => setBoardOpacity(Number(e.target.value) / 100)}
                className="w-full accent-[var(--accent-primary)]"
              />
              <p className="text-[10px] text-[var(--text-secondary)]">
                Higher values make the drawing surface more opaque over your video feed.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
