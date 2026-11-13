import {
  ArrowLeftRight,
  Maximize2,
  PanelLeft,
  PanelRight,
  Ratio,
  Rows3,
} from "lucide-react";
import { useAppStore, type GameLayoutPreset } from "../../store/useAppStore";

interface GameLayoutToolbarProps {
  className?: string;
  showFitToggle?: boolean;
}

export function GameLayoutToolbar({
  className = "",
  showFitToggle = true,
}: GameLayoutToolbarProps) {
  const gameLayout = useAppStore((s) => s.gameLayout);
  const setGameLayout = useAppStore((s) => s.setGameLayout);
  const swapGamePanels = useAppStore((s) => s.swapGamePanels);
  const cameraFit = useAppStore((s) => s.cameraFit);
  const toggleCameraFit = useAppStore((s) => s.toggleCameraFit);

  const presets: Array<{ id: GameLayoutPreset; label: string; icon: typeof PanelLeft }> = [
    { id: "camera-left", label: "Left", icon: PanelLeft },
    { id: "camera-right", label: "Right", icon: PanelRight },
    { id: "stadium", label: "Stadium", icon: Rows3 },
    { id: "cinema", label: "Cinema", icon: Maximize2 },
  ];

  return (
    <div
      className={`inline-flex items-center gap-1.5 p-1 rounded-xl border text-xs select-none backdrop-blur-md ${className}`}
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-hairline)",
      }}
    >
      <span
        className="px-1.5 text-[10px] font-bold uppercase tracking-wider hidden sm:inline"
        style={{ color: "var(--text-secondary)" }}
      >
        Layout:
      </span>

      <div
        className="inline-flex rounded-lg border p-0.5"
        style={{
          backgroundColor: "var(--bg-well)",
          borderColor: "var(--border-hairline)",
        }}
      >
        {presets.map(({ id, label, icon: Icon }) => {
          const isActive = gameLayout === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setGameLayout(id)}
              title={`Switch layout to ${label}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium interactive-control transition ${
                isActive ? "shadow-2xs font-semibold" : ""
              }`}
              style={{
                backgroundColor: isActive ? "var(--bg-surface)" : "transparent",
                color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
              }}
            >
              <Icon className="w-3 h-3" strokeWidth={1.5} />
              <span className="hidden md:inline">{label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={swapGamePanels}
        title="Swap camera & scoreboard positions"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium interactive-control transition"
        style={{
          backgroundColor: "var(--bg-well)",
          borderColor: "var(--border-hairline)",
          color: "var(--text-secondary)",
        }}
      >
        <ArrowLeftRight className="w-3 h-3" strokeWidth={1.5} />
        <span className="hidden lg:inline">Swap</span>
      </button>

      {showFitToggle && (
        <button
          type="button"
          onClick={toggleCameraFit}
          title={`Camera Feed Fit: currently ${cameraFit} (click to toggle)`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium interactive-control transition"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
            color: cameraFit === "cover" ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          <Ratio className="w-3 h-3" strokeWidth={1.5} />
          <span className="capitalize">{cameraFit}</span>
        </button>
      )}
    </div>
  );
}

