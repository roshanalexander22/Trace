import { Hand, Home, Paintbrush, Pause, Play, Settings, Swords, Volume2, VolumeX } from "lucide-react";
import { useAppStore, type AppMode } from "../../store/useAppStore";

const NAV_ITEMS: Array<{ id: AppMode; label: string; icon: typeof Home }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "rps", label: "RPS Arena", icon: Swords },
  { id: "canvas", label: "Air Canvas", icon: Paintbrush },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const trackingEnabled = useAppStore((s) => s.trackingEnabled);
  const toggleTracking = useAppStore((s) => s.toggleTracking);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const setSoundEnabled = useAppStore((s) => s.setSoundEnabled);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 py-2.5 shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
          <Hand className="h-4.5 w-4.5" />
        </div>
        <div>
          <span className="text-sm font-bold tracking-tight text-slate-900">TRACE</span>
          <span className="ml-2 hidden rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 sm:inline-block">
            Rust + MediaPipe
          </span>
        </div>
      </div>

      <nav className="flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Mute Audio" : "Enable Audio"}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-2xs transition hover:bg-slate-100 hover:text-slate-900"
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
        </button>

        <button
          onClick={toggleTracking}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
            trackingEnabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          {trackingEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {trackingEnabled ? "Pause AI" : "Resume AI"}
        </button>
      </div>
    </header>
  );
}

