import { Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { CountdownOverlay } from "../components/rps/CountdownOverlay";
import { HandAnimation } from "../components/rps/HandAnimation";
import { MatchResultBanner } from "../components/rps/MatchResultBanner";
import { Scoreboard } from "../components/rps/Scoreboard";
import { CameraPreview } from "../components/vision/CameraPreview";
import { HandSkeletonOverlay } from "../components/vision/HandSkeletonOverlay";
import { useAudioFeedback } from "../hooks/useAudioFeedback";
import type { CameraState } from "../hooks/useCamera";
import { platform } from "../platform";
import type { GestureKind, RpsMove } from "../platform/types";
import { useAppStore } from "../store/useAppStore";
import { useGameStore } from "../store/useGameStore";
import { visionBus } from "../vision/visionBus";

interface RpsArenaPageProps {
  camera: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

function gestureToRpsMove(g: GestureKind): RpsMove | null {
  if (g === "Rock") return "Rock";
  if (g === "Paper") return "Paper";
  if (g === "Scissors" || g === "PeaceHover") return "Scissors";
  return null;
}

export function RpsArenaPage({ camera, videoRef }: RpsArenaPageProps) {
  const mirror = useAppStore((s) => s.calibration.mirror_feed);
  const live = useAppStore((s) => s.live);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const audio = useAudioFeedback(soundEnabled);

  const phase = useGameStore((s) => s.phase);
  const countdownValue = useGameStore((s) => s.countdownValue);
  const autoNextRound = useGameStore((s) => s.autoNextRound);
  const commitmentSha256 = useGameStore((s) => s.commitmentSha256);
  const lastResult = useGameStore((s) => s.lastResult);
  const scoreboard = useGameStore((s) => s.scoreboard);

  const setPhase = useGameStore((s) => s.setPhase);
  const setCountdownValue = useGameStore((s) => s.setCountdownValue);
  const setAutoNextRound = useGameStore((s) => s.setAutoNextRound);
  const setCommitment = useGameStore((s) => s.setCommitment);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const setScoreboard = useGameStore((s) => s.setScoreboard);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    void platform.rpsGetScoreboard().then(setScoreboard).catch(() => {});
    return () => clearTimers();
  }, [clearTimers, setScoreboard]);

  const resolveCapturedMove = useCallback(
    async (roundId: string, playerMove: RpsMove) => {
      try {
        const res = await platform.rpsResolveRound(roundId, playerMove);
        setLastResult(res);
        setScoreboard(res.scoreboard);
        setPhase("REVEAL");
        if (res.outcome === "PlayerWin") audio.playWin();
        else if (res.outcome === "AiWin") audio.playLose();
        else audio.playDraw();
      } catch {
        setPhase("IDLE");
      }
    },
    [audio, setLastResult, setPhase, setScoreboard],
  );

  const startRound = useCallback(async () => {
    clearTimers();
    setLastResult(null);
    setPhase("COUNTDOWN");
    setCountdownValue(3);
    audio.playTick();

    let roundId = "";
    try {
      const commit = await platform.rpsStartRound();
      roundId = commit.round_id;
      setCommitment(commit.round_id, commit.commitment_sha256);
    } catch {
      setPhase("IDLE");
      return;
    }

    const t1 = window.setTimeout(() => {
      setCountdownValue(2);
      audio.playTick();
    }, 750);

    const t2 = window.setTimeout(() => {
      setCountdownValue(1);
      audio.playTick();
    }, 1500);

    const t3 = window.setTimeout(() => {
      setCountdownValue(0);
      setPhase("CAPTURE");
      audio.playShoot();

      const shootAt = performance.now();
      const votes: Record<RpsMove, number> = { Rock: 0, Paper: 0, Scissors: 0 };

      const samplePostShoot = () => {
        const elapsed = performance.now() - shootAt;
        const latestEvent = visionBus.latest;

        if (latestEvent && latestEvent.timestampMs >= shootAt + 140 && latestEvent.frame.detected) {
          const stableMove = gestureToRpsMove(latestEvent.frame.stable_gesture);
          const rawMove = gestureToRpsMove(latestEvent.frame.raw_gesture);
          if (stableMove) {
            votes[stableMove] += 2;
          } else if (rawMove) {
            votes[rawMove] += 1;
          }
        }

        const totalVotes = votes.Rock + votes.Paper + votes.Scissors;
        if (elapsed >= 420 && (totalVotes >= 2 || elapsed >= 850)) {
          let chosen: RpsMove | null = null;
          if (totalVotes > 0) {
            const ranked = (["Scissors", "Paper", "Rock"] as RpsMove[]).sort(
              (a, b) => votes[b] - votes[a],
            );
            chosen = ranked[0];
          } else if (latestEvent?.frame.detected) {
            chosen =
              gestureToRpsMove(latestEvent.frame.stable_gesture) ??
              gestureToRpsMove(latestEvent.frame.raw_gesture);
          }

          if (chosen) {
            void resolveCapturedMove(roundId, chosen);
          } else {
            setPhase("NO_GESTURE_RETRY");
          }
          return;
        }

        const nextId = window.setTimeout(samplePostShoot, 55);
        timersRef.current.push(nextId);
      };

      const startSampleId = window.setTimeout(samplePostShoot, 220);
      timersRef.current.push(startSampleId);
    }, 2250);

    timersRef.current.push(t1, t2, t3);
  }, [audio, clearTimers, resolveCapturedMove, setCommitment, setCountdownValue, setLastResult, setPhase]);

  useEffect(() => {
    if (phase === "REVEAL" && autoNextRound) {
      const id = window.setTimeout(() => {
        void startRound();
      }, 2400);
      timersRef.current.push(id);
      return () => window.clearTimeout(id);
    }
  }, [autoNextRound, phase, startRound]);

  const handleResetScores = async () => {
    await platform.rpsResetScoreboard();
    const fresh = await platform.rpsGetScoreboard();
    setScoreboard(fresh);
    setLastResult(null);
  };

  const detectedRps = live.detected ? gestureToRpsMove(live.stableGesture) : null;
  const aiPose =
    phase === "COUNTDOWN"
      ? "pumping"
      : phase === "REVEAL" && lastResult
        ? lastResult.ai_move
        : "idle";

  const aiAccent =
    phase === "REVEAL" && lastResult
      ? lastResult.outcome === "PlayerWin"
        ? "emerald"
        : lastResult.outcome === "AiWin"
          ? "rose"
          : "amber"
      : "cyan";

  return (
    <div
      className="h-full w-full overflow-y-auto p-4 sm:p-5 select-none"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      <div className="mx-auto max-w-7xl h-full grid gap-4 lg:grid-cols-[1.38fr_1fr]">
        {/* Left 58%: Rounded Camera Stage (16px radius) with HUD Controls Floating Inside */}
        <div className="flex flex-col gap-3 min-w-0">
          <div
            className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden border shadow-sm"
            style={{
              backgroundColor: "var(--bg-well)",
              borderColor: "var(--border-hairline)",
            }}
          >
            {camera.error ? (
              <CameraPermissionGuard
                error={camera.error}
                onRetry={() => void camera.startCamera(camera.activeDeviceId)}
              />
            ) : (
              <>
                <CameraPreview videoRef={videoRef} stream={camera.stream} mirror={mirror} />
                <HandSkeletonOverlay />
                <CountdownOverlay active={phase === "COUNTDOWN" || phase === "CAPTURE"} value={countdownValue} />
              </>
            )}

            {/* Top-Left: Player Live Sign Badge */}
            <div
              className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium backdrop-blur-md"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>Your Hand:</span>
              <span className="font-semibold" style={{ color: detectedRps ? "var(--status-ready)" : "var(--text-primary)" }}>
                {detectedRps ?? (live.detected ? "Adjusting..." : "No Hand")}
              </span>
            </div>

            {/* Top-Right: Pre-Commitment Badge */}
            {commitmentSha256 && phase === "COUNTDOWN" && (
              <div
                className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold backdrop-blur-md"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-hairline)",
                  color: "var(--status-ready)",
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Move Pre-Locked</span>
              </div>
            )}

            {/* Floating HUD Inside Bottom of Frame (Eyes Stay Locked on Hand Feed!) */}
            <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border backdrop-blur-md"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void startRound()}
                  disabled={phase === "COUNTDOWN" || phase === "CAPTURE" || Boolean(camera.error)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold interactive-control disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent-primary)",
                    color: "var(--accent-contrast)",
                  }}
                >
                  {phase === "REVEAL" || phase === "NO_GESTURE_RETRY" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Play Again</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Start Countdown</span>
                    </>
                  )}
                </button>

                <label
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-pointer interactive-control"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoNextRound}
                    onChange={(e) => setAutoNextRound(e.target.checked)}
                    className="accent-[var(--accent-primary)] rounded w-3.5 h-3.5"
                  />
                  <span>Auto-Next</span>
                </label>
              </div>

              <span className="hidden sm:inline-block text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Show ✊ Rock, ✋ Paper, or ✌️ Scissors at <strong style={{ color: "var(--text-primary)" }}>SHOOT!</strong>
              </span>
            </div>
          </div>

          {phase === "NO_GESTURE_RETRY" && (
            <div
              className="p-3 rounded-xl border text-xs"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
                color: "var(--accent-primary)",
              }}
            >
              No valid Rock, Paper, or Scissors gesture was detected at capture. Keep your hand inside the frame and hit Play Again.
            </div>
          )}

          <MatchResultBanner result={lastResult} />
        </div>

        {/* Right 42%: Opponent Stage (Clean Geometric Target Frame) + Scoreboard */}
        <div className="flex flex-col gap-3 min-w-0">
          <div
            className="flex flex-col items-center justify-center p-5 rounded-2xl border"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-hairline)",
            }}
          >
            <div
              className="mb-1 text-[10px] font-bold tracking-wider uppercase"
              style={{ color: "var(--text-secondary)" }}
            >
              AI Opponent Stage
            </div>

            <HandAnimation pose={aiPose} beat={countdownValue} accent={aiAccent} sizeClass="h-40 w-40" />

            <div
              className="mt-1 text-xs font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {phase === "COUNTDOWN"
                ? "Locking Gesture..."
                : phase === "REVEAL" && lastResult
                  ? `AI Played: ${lastResult.ai_move}`
                  : "Ready for Next Round"}
            </div>
          </div>

          <Scoreboard scoreboard={scoreboard} onReset={() => void handleResetScores()} />
        </div>
      </div>
    </div>
  );
}
