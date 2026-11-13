import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { NavigationRail } from "./components/layout/NavigationRail";
import { TopHeader } from "./components/layout/TopHeader";
import { StatusBar } from "./components/layout/StatusBar";
import { useCamera } from "./hooks/useCamera";
import { useHandTracking } from "./hooks/useHandTracking";
import { platform } from "./platform";
import { AirCanvasPage } from "./pages/AirCanvasPage";
import { HandCricketPage } from "./pages/HandCricketPage";
import { HomePage } from "./pages/HomePage";
import { RpsArenaPage } from "./pages/RpsArenaPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SplitArenaPage } from "./pages/SplitArenaPage";
import { useAppStore } from "./store/useAppStore";

export function App() {
  const mode = useAppStore((s) => s.mode);
  const theme = useAppStore((s) => s.theme);
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const trackingEnabled = useAppStore((s) => s.trackingEnabled);
  const toggleTracking = useAppStore((s) => s.toggleTracking);
  const setCalibration = useAppStore((s) => s.setCalibration);
  const setSystemTelemetry = useAppStore((s) => s.setSystemTelemetry);
  const cameraBootedRef = useRef(false);

  const camera = useCamera();
  useHandTracking(camera.videoRef, camera.streamActive, trackingEnabled && cameraEnabled);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const cal = await platform.loadCalibration();
        if (!mounted) return;
        setCalibration(cal);
        cameraBootedRef.current = true;
        if (useAppStore.getState().cameraEnabled) {
          await camera.startCamera(cal.preferred_camera_id);
        }
      } catch {
        cameraBootedRef.current = true;
        if (mounted && useAppStore.getState().cameraEnabled) {
          await camera.startCamera();
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // Boot camera & calibration once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond when user toggles hardware Camera On / Off
  useEffect(() => {
    if (!cameraBootedRef.current) return;
    if (cameraEnabled) {
      const preferred = useAppStore.getState().calibration.preferred_camera_id;
      void camera.startCamera(preferred);
    } else {
      camera.stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraEnabled]);

  // Poll lightweight system telemetry (RSS RAM) every 2s
  useEffect(() => {
    const fetchTelemetry = () => {
      void platform.getSystemTelemetry().then(setSystemTelemetry).catch(() => {});
    };
    fetchTelemetry();
    const id = window.setInterval(fetchTelemetry, 2000);
    return () => window.clearInterval(id);
  }, [setSystemTelemetry]);

  // Listen for global shortcut (Ctrl+Shift+T) in Tauri desktop
  useEffect(() => {
    if (!platform.isTauri) return;
    let unlisten: (() => void) | undefined;
    void listen("trace://toggle-tracking", () => {
      toggleTracking();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [toggleTracking]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-none"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      {/* 3-Zone Shell: Zone 1 Left Navigation Rail */}
      <NavigationRail />

      {/* Zone 2 & 3: Main App Area with Top Hardware Strip + Central View + Micro Status */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <TopHeader camera={camera} />

        <main className="relative flex-1 overflow-hidden">
          {mode === "home" && <HomePage camera={camera} videoRef={camera.videoRef} />}
          {mode === "rps" && <RpsArenaPage camera={camera} videoRef={camera.videoRef} />}
          {mode === "split" && <SplitArenaPage camera={camera} videoRef={camera.videoRef} />}
          {mode === "cricket" && <HandCricketPage camera={camera} videoRef={camera.videoRef} />}
          {mode === "canvas" && <AirCanvasPage camera={camera} videoRef={camera.videoRef} />}
          {mode === "settings" && <SettingsPage camera={camera} />}
        </main>

        <StatusBar />
      </div>
    </div>
  );
}

export default App;

