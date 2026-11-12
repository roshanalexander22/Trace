import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { RpsResultDto } from "../../platform/types";

interface MatchResultBannerProps {
  result: RpsResultDto | null;
}

export function MatchResultBanner({ result }: MatchResultBannerProps) {
  const [showProof, setShowProof] = useState(false);

  if (!result) return null;

  const isWin = result.outcome === "PlayerWin";
  const isLoss = result.outcome === "AiWin";

  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs transition ${
        isWin
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : isLoss
            ? "border-rose-200 bg-rose-50 text-rose-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-bold">
            {isWin ? "You Won This Round!" : isLoss ? "AI Takes This Round" : "It's a Draw!"}
          </p>
          <p className="text-xs opacity-80">
            You: <span className="font-semibold">{result.player_move}</span> vs AI:{" "}
            <span className="font-semibold">{result.ai_move}</span>
          </p>
        </div>

        <button
          onClick={() => setShowProof((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-current/25 bg-white/80 px-2.5 py-1 text-xs font-medium hover:bg-white"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {showProof ? "Hide Fair Proof" : "Fair Play Proof"}
        </button>
      </div>

      {showProof && (
        <div className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-white/90 p-3 font-mono text-[11px] text-slate-700">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            AI move locked at countdown 3 before camera capture
          </div>
          <div className="truncate">SHA-256: {result.commitment_sha256}</div>
          <div className="truncate">
            Payload: {result.ai_move}:{result.salt_hex}
          </div>
        </div>
      )}
    </div>
  );
}

