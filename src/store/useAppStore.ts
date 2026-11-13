import { create } from "zustand";
import {
  DEFAULT_CALIBRATION,
  type CalibrationProfile,
  type DrawingState,
  type GestureKind,
  type SystemTelemetryDto,
} from "../platform/types";

export type AppMode = "home" | "rps" | "split" | "cricket" | "canvas" | "settings";
export type AppTheme = "light" | "dark";

export interface LiveTelemetry {
  fps: number;
  inferenceMs: number;
  activeDelegate: string;
  rendererName?: string;
  detected: boolean;
  stableGesture: GestureKind;
  drawingState: DrawingState;
  confidence: number;
  lowLightWarning: boolean;
  fingerBitmask: [boolean, boolean, boolean, boolean, boolean];
  fingerAnglesDeg: [number, number, number, number, number];
}

interface AppStoreState {
  mode: AppMode;
  theme: AppTheme;
  navCollapsed: boolean;
  cameraEnabled: boolean;
  trackingEnabled: boolean;
  soundEnabled: boolean;
  visionReady: boolean;
  visionError: string | null;
  calibration: CalibrationProfile;
  live: LiveTelemetry;
  systemTelemetry: SystemTelemetryDto;

  setMode: (mode: AppMode) => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setNavCollapsed: (collapsed: boolean) => void;
  toggleNav: () => void;
  setCameraEnabled: (enabled: boolean) => void;
  toggleCamera: () => void;
  setTrackingEnabled: (enabled: boolean) => void;
  toggleTracking: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVisionReady: (ready: boolean, delegate?: string) => void;
  setVisionError: (err: string | null) => void;
  setCalibration: (cal: CalibrationProfile) => void;
  patchCalibration: (patch: Partial<CalibrationProfile>) => void;
  setLiveTelemetry: (live: LiveTelemetry) => void;
  setSystemTelemetry: (sys: SystemTelemetryDto) => void;
}

const getStoredTheme = (): AppTheme => {
  try {
    const saved = localStorage.getItem("trace_theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return "light";
};

export const useAppStore = create<AppStoreState>((set) => ({
  mode: "home",
  theme: getStoredTheme(),
  navCollapsed: false,
  cameraEnabled: true,
  trackingEnabled: true,
  soundEnabled: true,
  visionReady: false,
  visionError: null,
  calibration: DEFAULT_CALIBRATION,
  live: {
    fps: 0,
    inferenceMs: 0,
    activeDelegate: "GPU",
    detected: false,
    stableGesture: "None",
    drawingState: "Idle",
    confidence: 0,
    lowLightWarning: false,
    fingerBitmask: [false, false, false, false, false],
    fingerAnglesDeg: [0, 0, 0, 0, 0],
  },
  systemTelemetry: {
    memory_mb: 0,
    os_platform: "unknown",
  },

  setMode: (mode) => set({ mode }),
  setTheme: (theme) => {
    try {
      localStorage.setItem("trace_theme", theme);
    } catch {}
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next: AppTheme = s.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("trace_theme", next);
      } catch {}
      document.documentElement.setAttribute("data-theme", next);
      return { theme: next };
    }),
  setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
  toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  toggleCamera: () => set((s) => ({ cameraEnabled: !s.cameraEnabled })),
  setTrackingEnabled: (trackingEnabled) => set({ trackingEnabled }),
  toggleTracking: () => set((s) => ({ trackingEnabled: !s.trackingEnabled })),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setVisionReady: (visionReady, delegate) =>
    set((s) => ({
      visionReady,
      visionError: visionReady ? null : s.visionError,
      live: delegate ? { ...s.live, activeDelegate: delegate } : s.live,
    })),
  setVisionError: (visionError) => set({ visionError, visionReady: false }),
  setCalibration: (calibration) => set({ calibration }),
  patchCalibration: (patch) =>
    set((s) => ({ calibration: { ...s.calibration, ...patch } })),
  setLiveTelemetry: (live) => set({ live }),
  setSystemTelemetry: (systemTelemetry) => set({ systemTelemetry }),
}));

