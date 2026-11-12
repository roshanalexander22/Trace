import { Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { CameraState } from "../hooks/useCamera";
import { useAudioFeedback } from "../hooks/useAudioFeedback";
import { platform } from "../platform";
import type { GestureKind, RpsMove } from "../platform/types";
import { useAppStore } from "../store/useAppStore";
import { useGameStore } from "../store/useGameStore";
import { visionBus } from "../vision/visionBus";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { CameraPreview } from "../components/vision/CameraPreview";
import { CameraSelector } from "../components/vision/CameraSelector";
import { HandSkeletonOverlay } from "../components/vision/HandSkeletonOverlay";
import { CountdownOverlay } from "../components/rps/CountdownOverlay";
import { HandAnimation } from "../components/rps/HandAnimation";
import { MatchResultBanner } from "../components/rps/MatchResultBanner";
import { Scoreboard } from "../components/rps/Scoreboard";

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

      // Wait briefly after "SHOOT!" so pre-shoot countdown fist frames never get captured,
      // then collect fresh post-shoot frames and pick the settled RPS gesture.
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
    <div className="mx-auto grid h-full w-full max-w-6xl gap-4 overflow-y-auto p-4 lg:grid-cols-[1.25fr_1fr]">
      {/* Left: Player Camera Feed */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-video w-full flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-lg min-h-[300px]">
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

          {/* Top-left player gesture readout */}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs shadow-md backdrop-blur">
            <span className="text-slate-500">Your Hand:</span>
            <span className="font-bold text-sky-700">
              {detectedRps ?? (live.detected ? "Adjust Pose" : "No Hand")}
            </span>
          </div>

          {commitmentSha256 && phase === "COUNTDOWN" && (
            <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 shadow-md backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              AI Move Locked
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => void startRound()}
              disabled={phase === "COUNTDOWN" || phase === "CAPTURE" || Boolean(camera.error)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-500 disabled:opacity-50"
            >
              {phase === "REVEAL" || phase === "NO_GESTURE_RETRY" ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Play Again
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Countdown
                </>
              )}
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={autoNextRound}
                onChange={(e) => setAutoNextRound(e.target.checked)}
                className="h-4 w-4 rounded accent-sky-600"
              />
              Auto-Next Round
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CameraSelector camera={camera} compact />
            <span className="text-xs text-slate-500">
              Show ✊ Rock, ✋ Paper, or ✌️ Scissors at{" "}
              <strong className="text-slate-800">SHOOT!</strong>
            </span>
          </div>
        </div>

        {phase === "NO_GESTURE_RETRY" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No valid Rock, Paper, or Scissors gesture was detected at capture. Keep your hand inside
            the frame and hit <strong>Play Again</strong>.
          </div>
        )}

        <MatchResultBanner result={lastResult} />
      </div>

      {/* Right: AI Companion & Scoreboard */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-sky-50/70 p-5 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            AI Opponent
          </div>
          <HandAnimation pose={aiPose} beat={countdownValue} accent={aiAccent} />
          <div className="mt-1 text-sm font-bold text-slate-900">
            {phase === "COUNTDOWN"
              ? "Locking Move..."
              : phase === "REVEAL" && lastResult
                ? `AI Played: ${lastResult.ai_move}`
                : "Ready to Play"}
          </div>
        </div>

        <Scoreboard scoreboard={scoreboard} onReset={() => void handleResetScores()} />
      </div>
    </div>
  );
}
