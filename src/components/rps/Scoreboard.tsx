import { Flame, RotateCcw, Trophy } from "lucide-react";
import type { ScoreboardSummaryDto } from "../../platform/types";

interface ScoreboardProps {
  scoreboard: ScoreboardSummaryDto;
  onReset: () => void;
}

export function Scoreboard({ scoreboard, onReset }: ScoreboardProps) {
  const winPct = Math.round(scoreboard.win_rate * 100);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Trophy className="h-4 w-4 text-amber-500" />
          Scoreboard
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
          <div className="text-xl font-bold text-emerald-700">{scoreboard.player_wins}</div>
          <div className="text-[11px] text-emerald-700/80">You</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5">
          <div className="text-xl font-bold text-rose-700">{scoreboard.ai_wins}</div>
          <div className="text-[11px] text-rose-700/80">AI</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-100 p-2.5">
          <div className="text-xl font-bold text-slate-800">{scoreboard.draws}</div>
          <div className="text-[11px] text-slate-500">Draws</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-2.5">
          <div className="text-xl font-bold text-sky-700">{winPct}%</div>
          <div className="text-[11px] text-sky-700/80">Win Rate</div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="text-slate-600">Total Rounds: {scoreboard.total_rounds}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Flame className="h-3.5 w-3.5" />
          Streak: {scoreboard.current_streak > 0 ? `+${scoreboard.current_streak}` : scoreboard.current_streak}
        </span>
      </div>

      <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
        {scoreboard.recent_matches.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            Play your first round to record history.
          </p>
        ) : (
          scoreboard.recent_matches.slice(0, 12).map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs"
            >
              <span className="text-slate-700">
                {m.player_move} vs {m.ai_move}
              </span>
              <span
                className={`font-semibold ${
                  m.outcome === "PlayerWin"
                    ? "text-emerald-600"
                    : m.outcome === "AiWin"
                      ? "text-rose-600"
                      : "text-amber-600"
                }`}
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

