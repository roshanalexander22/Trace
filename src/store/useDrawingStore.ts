import { create } from "zustand";
import type { StrokeDto } from "../platform/types";

export type CameraOpacityMode = "overlay" | "pip" | "hidden";
export type DrawingTool =
  | "pen"
  | "highlighter"
  | "spray"
  | "line"
  | "rect"
  | "circle"
  | "eraser";
export type BackgroundPattern = "none" | "dots" | "grid";

export const PALETTE_COLORS = [
  "#0284c7", // Sky Blue
  "#e11d48", // Rose Red
  "#7c3aed", // Violet
  "#059669", // Emerald
  "#d97706", // Amber
  "#0f172a", // Deep Ink
  "#ec4899", // Pink
  "#0891b2", // Teal
];

export const BRUSH_SIZES = [4, 8, 16, 28];

interface DrawingStoreState {
  artworkId: string;
  artworkTitle: string;
  strokes: StrokeDto[];
  redoStack: StrokeDto[];
  tool: DrawingTool;
  color: string;
  brushWidth: number;
  strokeOpacity: number;
  boardOpacity: number;
  backgroundPattern: BackgroundPattern;
  cameraMode: CameraOpacityMode;
  dwellToolbar: boolean;

  setTool: (tool: DrawingTool) => void;
  setColor: (color: string) => void;
  setBrushWidth: (w: number) => void;
  setStrokeOpacity: (opacity: number) => void;
  setBoardOpacity: (opacity: number) => void;
  setBackgroundPattern: (pattern: BackgroundPattern) => void;
  setCameraMode: (mode: CameraOpacityMode) => void;
  setDwellToolbar: (enabled: boolean) => void;
  setArtworkTitle: (title: string) => void;
  commitStroke: (stroke: StrokeDto) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  newArtwork: () => void;
  loadArtworkData: (id: string, title: string, strokes: StrokeDto[]) => void;
}

export const useDrawingStore = create<DrawingStoreState>((set) => ({
  artworkId: crypto.randomUUID(),
  artworkTitle: "Air Sketch",
  strokes: [],
  redoStack: [],
  tool: "pen",
  color: PALETTE_COLORS[0],
  brushWidth: BRUSH_SIZES[1],
  strokeOpacity: 1,
  boardOpacity: 0.15,
  backgroundPattern: "none",
  cameraMode: "overlay",
  dwellToolbar: true,

  setTool: (tool) => set({ tool }),
  setColor: (color) =>
    set((s) => ({
      color,
      tool: s.tool === "eraser" ? "pen" : s.tool,
    })),
  setBrushWidth: (brushWidth) => set({ brushWidth }),
  setStrokeOpacity: (strokeOpacity) =>
    set({ strokeOpacity: Math.max(0.1, Math.min(1, strokeOpacity)) }),
  setBoardOpacity: (boardOpacity) =>
    set({ boardOpacity: Math.max(0, Math.min(1, boardOpacity)) }),
  setBackgroundPattern: (backgroundPattern) => set({ backgroundPattern }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setDwellToolbar: (dwellToolbar) => set({ dwellToolbar }),
  setArtworkTitle: (artworkTitle) => set({ artworkTitle }),

  commitStroke: (stroke) =>
    set((s) => ({
      strokes: [...s.strokes, stroke],
      redoStack: [],
    })),

  undo: () =>
    set((s) => {
      if (s.strokes.length === 0) return s;
      const last = s.strokes[s.strokes.length - 1];
      return {
        strokes: s.strokes.slice(0, -1),
        redoStack: [...s.redoStack, last],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const restored = s.redoStack[s.redoStack.length - 1];
      return {
        strokes: [...s.strokes, restored],
        redoStack: s.redoStack.slice(0, -1),
      };
    }),

  clear: () =>
    set({
      strokes: [],
      redoStack: [],
    }),

  newArtwork: () =>
    set({
      artworkId: crypto.randomUUID(),
      artworkTitle: "Air Sketch",
      strokes: [],
      redoStack: [],
    }),

  loadArtworkData: (artworkId, artworkTitle, strokes) =>
    set({
      artworkId,
      artworkTitle,
      strokes,
      redoStack: [],
    }),
}));
