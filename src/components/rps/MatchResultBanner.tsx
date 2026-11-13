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
      className="p-3.5 rounded-xl border select-none transition"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: isWin
          ? "var(--status-ready)"
          : isLoss
            ? "var(--accent-primary)"
            : "var(--border-hairline)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p
            className="text-sm font-semibold tracking-[-0.01em]"
            style={{
              color: isWin
                ? "var(--status-ready)"
                : isLoss
                  ? "var(--accent-primary)"
                  : "var(--text-primary)",
            }}
          >
            {isWin ? "You Won This Round" : isLoss ? "AI Takes This Round" : "It's a Draw"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            You: <strong style={{ color: "var(--text-primary)" }}>{result.player_move}</strong> · AI:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{result.ai_move}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowProof((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium interactive-control"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
            color: "var(--text-secondary)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>{showProof ? "Hide Proof" : "Fair Proof"}</span>
        </button>
      </div>

      {showProof && (
        <div
          className="mt-2.5 p-2.5 rounded-lg border font-mono text-[10px] space-y-1 telemetry-value"
          style={{
            backgroundColor: "var(--bg-well)",
            borderColor: "var(--border-hairline)",
            color: "var(--text-secondary)",
          }}
        >
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--status-ready)" }}>
            <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />
            <span>AI move committed with SHA-256 before camera capture</span>
          </div>
          <div className="truncate">Hash: {result.commitment_sha256}</div>
          <div className="truncate">Payload: {result.ai_move}:{result.salt_hex}</div>
        </div>
      )}
    </div>
  );
}
