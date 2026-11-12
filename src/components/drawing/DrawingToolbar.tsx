import {
  Circle,
  Download,
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
  Sparkles,
  Square,
  Trash2,
  Undo2,
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
  { id: "spray", label: "Airbrush", icon: Sparkles },
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
  artworks,
  onRefreshArtworks,
  onOpenArtwork,
  onSaveProject,
  onExportPng,
  onExportSvg,
}: DrawingToolbarProps) {
  const [showSavedMenu, setShowSavedMenu] = useState(false);

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
    <div className="relative z-20 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      {/* Row 1: Drawing Tools, History & File Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {TOOLS.map(({ id, label, icon: Icon }) => {
            const active = tool === id;
            return (
              <button
                key={id}
                data-dwell-id={`tool-${id}`}
                onClick={() => setTool(id)}
                title={label}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? id === "eraser"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* History */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
            <button
              data-dwell-id="action-undo"
              onClick={undo}
              disabled={strokesCount === 0}
              title="Undo (Ctrl+Z)"
              className="rounded-lg bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              data-dwell-id="action-redo"
              onClick={redo}
              disabled={redoCount === 0}
              title="Redo (Ctrl+Y)"
              className="rounded-lg bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              data-dwell-id="action-clear"
              onClick={clear}
              disabled={strokesCount === 0}
              title="Clear Canvas"
              className="rounded-lg bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* File / Export */}
          <button
            onClick={newArtwork}
            title="New Blank Canvas"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open</span>
            </button>

            {showSavedMenu && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Saved Sketches
                </div>
                {artworks.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-slate-400">
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
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700"
                      >
                        <span className="truncate font-medium">{a.title}</span>
                        <span className="text-[11px] text-slate-400">{a.stroke_count}</span>
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
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
          <button
            onClick={onExportPng}
            disabled={strokesCount === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          >
            <FileImage className="h-3.5 w-3.5" />
            PNG
          </button>
          <button
            onClick={onExportSvg}
            disabled={strokesCount === 0}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-sky-500 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            SVG
          </button>
        </div>
      </div>

      {/* Row 2: Color Picker, Size, Ink Opacity, Board Opacity & Canvas Options */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-2">
        {/* Colors + Custom Color Wheel */}
        <div className="flex items-center gap-1.5">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              data-dwell-id={`color-${c}`}
              onClick={() => setColor(c)}
              title={`Color ${c}`}
              className={`h-6 w-6 rounded-full border-2 transition ${
                tool !== "eraser" && color === c
                  ? "scale-110 border-slate-900 ring-2 ring-sky-500/40"
                  : "border-slate-200 hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label
            title="Custom Color"
            className="relative ml-0.5 flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-300 shadow-2xs"
            style={{ background: "conic-gradient(#ef4444,#eab308,#22c55e,#0ea5e9,#8b5cf6,#ef4444)" }}
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

        {/* Sliders: Brush Size, Stroke Opacity, Board Opacity */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Size</span>
            <input
              type="range"
              min={2}
              max={48}
              step={1}
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              className="w-20 accent-sky-600"
            />
            <span className="w-8 font-mono text-[11px] font-semibold text-slate-800">
              {brushWidth}px
            </span>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Ink</span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(strokeOpacity * 100)}
              onChange={(e) => setStrokeOpacity(Number(e.target.value) / 100)}
              className="w-20 accent-sky-600"
            />
            <span className="w-9 font-mono text-[11px] font-semibold text-slate-800">
              {Math.round(strokeOpacity * 100)}%
            </span>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-medium text-sky-700">Board Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(boardOpacity * 100)}
              onChange={(e) => setBoardOpacity(Number(e.target.value) / 100)}
              className="w-24 accent-sky-600"
            />
            <span className="w-9 font-mono text-[11px] font-semibold text-sky-700">
              {Math.round(boardOpacity * 100)}%
            </span>
          </label>
        </div>

        {/* Background Grid + View Mode + Dwell */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px]">
            <Grid3x3 className="mx-1 h-3.5 w-3.5 text-slate-500" />
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => setBackgroundPattern(p.id)}
                className={`rounded-md px-1.5 py-0.5 font-medium transition ${
                  backgroundPattern === p.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px]">
            <Eye className="mx-1 h-3.5 w-3.5 text-slate-500" />
            {CAMERA_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setCameraMode(m.id)}
                className={`rounded-md px-2 py-0.5 font-medium transition ${
                  cameraMode === m.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setDwellToolbar(!dwellToolbar)}
            className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
              dwellToolbar
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-slate-100 text-slate-500"
            }`}
            title="Trigger toolbar buttons by hovering 2 fingers (Peace) over them"
          >
            Dwell {dwellToolbar ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  );
}
