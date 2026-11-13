import { Flame, RotateCcw, Trophy } from "lucide-react";
import type { ScoreboardSummaryDto } from "../../platform/types";

interface ScoreboardProps {
  scoreboard: ScoreboardSummaryDto;
  onReset: () => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function Scoreboard({
  scoreboard,
  onReset,
  className = "",
  orientation = "vertical",
}: ScoreboardProps) {
  const winPct = Math.round(scoreboard.win_rate * 100);

  if (orientation === "horizontal") {
    return (
      <div
        className={`flex flex-col md:flex-row gap-3 p-4 rounded-2xl border select-none ${className}`}
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-hairline)",
        }}
      >
        {/* Left Side: Scoreboard Header & 4 Metric Blocks */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-[280px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
              <span>Scoreboard & Metrics</span>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium interactive-control transition"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-secondary)",
              }}
            >
              <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="text-xl font-bold telemetry-value" style={{ color: "var(--status-ready)" }}>
                {scoreboard.player_wins}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>You</div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="text-xl font-bold telemetry-value" style={{ color: "var(--accent-primary)" }}>
                {scoreboard.ai_wins}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>AI</div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="text-xl font-bold telemetry-value" style={{ color: "var(--text-primary)" }}>
                {scoreboard.draws}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Draws</div>
            </div>
            <div
              className="p-2 rounded-xl border"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="text-xl font-bold telemetry-value" style={{ color: "var(--text-primary)" }}>
                {winPct}%
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Win Rate</div>
            </div>
          </div>

          <div
            className="flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs"
            style={{
              backgroundColor: "var(--bg-well)",
              borderColor: "var(--border-hairline)",
              color: "var(--text-secondary)",
            }}
          >
            <span className="telemetry-value">
              Total Rounds: <strong style={{ color: "var(--text-primary)" }}>{scoreboard.total_rounds}</strong>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold telemetry-value" style={{ color: "var(--accent-primary)" }}>
              <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
              Streak: {scoreboard.current_streak > 0 ? `+${scoreboard.current_streak}` : scoreboard.current_streak}
            </span>
          </div>
        </div>

        {/* Right Side: Horizontal Scrolling / Expandable Recent Rounds Stream */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-[240px]">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Match Timeline
          </div>
          <div className="flex-1 overflow-y-auto max-h-[140px] space-y-1 pr-1">
            {scoreboard.recent_matches.length === 0 ? (
              <p className="py-4 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                Play your first round to record history.
              </p>
            ) : (
              scoreboard.recent_matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-xl border text-xs"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                  }}
                >
                  <span style={{ color: "var(--text-primary)" }}>
                    {m.player_move} vs {m.ai_move}
                  </span>
                  <span
                    className="font-semibold telemetry-value text-[11px]"
                    style={{
                      color:
                        m.outcome === "PlayerWin"
                          ? "var(--status-ready)"
                          : m.outcome === "AiWin"
                            ? "var(--accent-primary)"
                            : "var(--text-secondary)",
                    }}
                  >
                    {m.outcome === "PlayerWin" ? "WIN" : m.outcome === "AiWin" ? "LOSS" : "DRAW"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-2xl border select-none ${className}`}
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-hairline)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Trophy className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
          <span>Scoreboard</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium interactive-control transition"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
            color: "var(--text-secondary)",
          }}
        >
          <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
          <span>Reset</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div
          className="p-2 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <div className="text-lg font-bold telemetry-value" style={{ color: "var(--status-ready)" }}>
            {scoreboard.player_wins}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>You</div>
        </div>
        <div
          className="p-2 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <div className="text-lg font-bold telemetry-value" style={{ color: "var(--accent-primary)" }}>
            {scoreboard.ai_wins}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>AI</div>
        </div>
        <div
          className="p-2 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <div className="text-lg font-bold telemetry-value" style={{ color: "var(--text-primary)" }}>
            {scoreboard.draws}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Draws</div>
        </div>
        <div
          className="p-2 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <div className="text-lg font-bold telemetry-value" style={{ color: "var(--text-primary)" }}>
            {winPct}%
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Win Rate</div>
        </div>
      </div>

      <div
        className="flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs"
        style={{
          backgroundColor: "var(--bg-well)",
          borderColor: "var(--border-hairline)",
          color: "var(--text-secondary)",
        }}
      >
        <span className="telemetry-value">
          Total Rounds: <strong style={{ color: "var(--text-primary)" }}>{scoreboard.total_rounds}</strong>
        </span>
        <span className="inline-flex items-center gap-1 font-semibold telemetry-value" style={{ color: "var(--accent-primary)" }}>
          <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
          Streak: {scoreboard.current_streak > 0 ? `+${scoreboard.current_streak}` : scoreboard.current_streak}
        </span>
      </div>

      <div className="flex-1 min-h-[120px] max-h-[380px] space-y-1 overflow-y-auto pr-1">
        {scoreboard.recent_matches.length === 0 ? (
          <p className="py-4 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
            Play your first round to record history.
          </p>
        ) : (
          scoreboard.recent_matches.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-2 rounded-xl border text-xs"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>
                {m.player_move} vs {m.ai_move}
              </span>
              <span
                className="font-semibold telemetry-value text-[11px]"
                style={{
                  color:
                    m.outcome === "PlayerWin"
                      ? "var(--status-ready)"
                      : m.outcome === "AiWin"
                        ? "var(--accent-primary)"
                        : "var(--text-secondary)",
                }}
              >
                {m.outcome === "PlayerWin" ? "WIN" : m.outcome === "AiWin" ? "LOSS" : "DRAW"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
