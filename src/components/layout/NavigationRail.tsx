import {
  ChevronLeft,
  ChevronRight,
  Grid,
  Moon,
  Paintbrush,
  Sliders,
  Split as SplitIcon,
  Sun,
  Swords,
  Trophy,
} from "lucide-react";
import { useAppStore, type AppMode } from "../../store/useAppStore";

interface NavItem {
  id: AppMode;
  label: string;
  shortLabel: string;
  icon: typeof Grid;
  section: "root" | "arena" | "studio";
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", shortLabel: "Home", icon: Grid, section: "root" },
  { id: "rps", label: "RPS Arena", shortLabel: "RPS", icon: Swords, section: "arena" },
  { id: "split", label: "Split", shortLabel: "Split", icon: SplitIcon, section: "arena" },
  { id: "cricket", label: "Hand Cricket", shortLabel: "Cricket", icon: Trophy, section: "arena" },
  { id: "canvas", label: "Air Canvas", shortLabel: "Canvas", icon: Paintbrush, section: "studio" },
];

export function NavigationRail() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const navCollapsed = useAppStore((s) => s.navCollapsed);
  const toggleNav = useAppStore((s) => s.toggleNav);

  const arenaItems = NAV_ITEMS.filter((i) => i.section === "arena");
  const studioItems = NAV_ITEMS.filter((i) => i.section === "studio");

  return (
    <>
      {/* Desktop / Tablet Left Navigation Rail */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 h-full transition-[width] duration-200 select-none border-r ${
          navCollapsed ? "w-16" : "w-[200px]"
        }`}
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-hairline)",
        }}
      >
        {/* Top: TRACE wordmark + collapse toggle */}
        <div className="flex flex-col">
          <div
            className="flex items-center justify-between h-[42px] px-3.5 border-b"
            style={{ borderColor: "var(--border-hairline)" }}
          >
            {!navCollapsed ? (
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold tracking-wider"
                  style={{ color: "var(--text-primary)" }}
                >
                  TRACE
                </span>
                <span
                  className="telemetry-value text-[9px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Rust · WASM
                </span>
              </div>
            ) : (
              <span
                className="mx-auto text-xs font-black tracking-widest"
                style={{ color: "var(--text-primary)" }}
              >
                T
              </span>
            )}

            <button
              type="button"
              onClick={toggleNav}
              title={navCollapsed ? "Expand Sidebar (200px)" : "Collapse Sidebar (64px)"}
              className="p-1 rounded interactive-control text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {navCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>

          {/* Primary Navigation Stack */}
          <nav className="flex flex-col gap-1 p-2">
            {/* Overview */}
            <button
              type="button"
              onClick={() => setMode("home")}
              title={navCollapsed ? "Overview" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium interactive-control ${
                mode === "home" ? "font-semibold" : ""
              } ${navCollapsed ? "justify-center px-0" : ""}`}
              style={{
                backgroundColor: mode === "home" ? "var(--accent-subtle)" : "transparent",
                color: mode === "home" ? "var(--accent-primary)" : "var(--text-secondary)",
              }}
            >
              <Grid className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {!navCollapsed && <span>Overview</span>}
            </button>

            {/* Divider */}
            <div
              className="my-1.5 border-t"
              style={{ borderColor: "var(--border-hairline)" }}
            />

            {/* Arena Section */}
            {!navCollapsed && (
              <span
                className="px-2.5 pt-1 pb-1 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: "var(--text-secondary)", opacity: 0.7 }}
              >
                Arena
              </span>
            )}
            {arenaItems.map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  title={navCollapsed ? label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium interactive-control ${
                    active ? "font-semibold" : ""
                  } ${navCollapsed ? "justify-center px-0" : ""}`}
                  style={{
                    backgroundColor: active ? "var(--accent-subtle)" : "transparent",
                    color: active ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {!navCollapsed && <span>{label}</span>}
                </button>
              );
            })}

            {/* Divider */}
            <div
              className="my-1.5 border-t"
              style={{ borderColor: "var(--border-hairline)" }}
            />

            {/* Studio Section */}
            {!navCollapsed && (
              <span
                className="px-2.5 pt-1 pb-1 text-[10px] font-bold tracking-wider uppercase"
                style={{ color: "var(--text-secondary)", opacity: 0.7 }}
              >
                Studio
              </span>
            )}
            {studioItems.map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  title={navCollapsed ? label : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium interactive-control ${
                    active ? "font-semibold" : ""
                  } ${navCollapsed ? "justify-center px-0" : ""}`}
                  style={{
                    backgroundColor: active ? "var(--accent-subtle)" : "transparent",
                    color: active ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {!navCollapsed && <span>{label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Pinned: Settings & Segmented Theme Switch */}
        <div
          className="flex flex-col gap-2 p-2 border-t"
          style={{ borderColor: "var(--border-hairline)" }}
        >
          {/* Settings / Calibration */}
          <button
            type="button"
            onClick={() => setMode("settings")}
            title={navCollapsed ? "Calibration & Settings" : undefined}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium interactive-control ${
              mode === "settings" ? "font-semibold" : ""
            } ${navCollapsed ? "justify-center px-0" : ""}`}
            style={{
              backgroundColor: mode === "settings" ? "var(--accent-subtle)" : "transparent",
              color: mode === "settings" ? "var(--accent-primary)" : "var(--text-secondary)",
            }}
          >
            <Sliders className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            {!navCollapsed && <span>Calibration</span>}
          </button>

          {/* Segmented Light / Dark Switch */}
          {!navCollapsed ? (
            <div
              className="flex items-center p-0.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[11px] font-medium interactive-control ${
                  theme === "light" ? "shadow-2xs font-semibold" : ""
                }`}
                style={{
                  backgroundColor: theme === "light" ? "var(--bg-surface)" : "transparent",
                  color: theme === "light" ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Sun className="w-3 h-3" strokeWidth={1.5} />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded text-[11px] font-medium interactive-control ${
                  theme === "dark" ? "shadow-2xs font-semibold" : ""
                }`}
                style={{
                  backgroundColor: theme === "dark" ? "var(--bg-surface)" : "transparent",
                  color: theme === "dark" ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <Moon className="w-3 h-3" strokeWidth={1.5} />
                <span>Dark</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              className="flex items-center justify-center p-2 rounded-lg interactive-control"
              style={{
                backgroundColor: "var(--bg-well)",
                color: "var(--text-secondary)",
              }}
            >
              {theme === "light" ? (
                <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
              ) : (
                <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile / Narrow Snap Bottom Navigation Bar (< 768px) */}
      <nav
        className="md:hidden flex items-center justify-around h-14 shrink-0 border-t z-30 select-none"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-hairline)",
        }}
      >
        {[
          { id: "home" as const, label: "Home", icon: Grid },
          { id: "rps" as const, label: "RPS", icon: Swords },
          { id: "split" as const, label: "Split", icon: SplitIcon },
          { id: "cricket" as const, label: "Cricket", icon: Trophy },
          { id: "canvas" as const, label: "Canvas", icon: Paintbrush },
          { id: "settings" as const, label: "Tune", icon: Sliders },
        ].map(({ id, label, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg interactive-control text-[10px]"
              style={{
                color: active ? "var(--accent-primary)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon className="w-4 h-4 mb-0.5" strokeWidth={1.5} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

