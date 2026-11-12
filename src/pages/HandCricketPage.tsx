import {
  Award,
  Flame,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { CountdownOverlay } from "../components/rps/CountdownOverlay";
import { HandAnimation } from "../components/rps/HandAnimation";
import { CameraPreview } from "../components/vision/CameraPreview";
import { CameraSelector } from "../components/vision/CameraSelector";
import { HandSkeletonOverlay } from "../components/vision/HandSkeletonOverlay";
import {
  HAND_CRICKET_LABELS,
  chooseAiHandCricketNumber,
  classifyHandCricketNumber,
  computeTossWinner,
  createInitialHandCricketState,
  formatOvers,
  resolveCricketBall,
  type CricketRole,
  type HandCricketDifficulty,
  type HandCricketMatchState,
  type HandCricketNumber,
  type TossParity,
} from "../games/handCricketEngine";
import { useAudioFeedback } from "../hooks/useAudioFeedback";
import type { CameraState } from "../hooks/useCamera";
import { useAppStore } from "../store/useAppStore";
import { visionBus } from "../vision/visionBus";

interface HandCricketPageProps {
  camera: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const GESTURE_PILLS: Array<{ num: HandCricketNumber; icon: string; short: string }> = [
  { num: 0, icon: "✊", short: "Fist" },
  { num: 1, icon: "☝️", short: "1 Finger" },
  { num: 2, icon: "✌️", short: "2 Fingers" },
  { num: 3, icon: "🤟", short: "3 Fingers" },
  { num: 4, icon: "🖐️", short: "4 Fingers" },
  { num: 5, icon: "✋", short: "Open Palm" },
  { num: 6, icon: "👍", short: "Thumb Up" },
];

export function HandCricketPage({ camera, videoRef }: HandCricketPageProps) {
  const mirror = useAppStore((s) => s.calibration.mirror_feed);
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const live = useAppStore((s) => s.live);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const audio = useAudioFeedback(soundEnabled);

  const [difficulty, setDifficulty] = useState<HandCricketDifficulty>("medium");
  const [oversLimit, setOversLimit] = useState<number | null>(null);
  const [match, setMatch] = useState<HandCricketMatchState>(() =>
    createInitialHandCricketState("medium", null),
  );
  const [seriesScore, setSeriesScore] = useState({ player: 0, ai: 0, ties: 0 });

  const [countdownValue, setCountdownValue] = useState<3 | 2 | 1 | 0>(3);
  const [captureActive, setCaptureActive] = useState(false);
  const [autoNextBall, setAutoNextBall] = useState(true);
  const [displayedAiNum, setDisplayedAiNum] = useState<HandCricketNumber | null>(null);
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);

  const matchRef = useRef(match);
  matchRef.current = match;
  const lockedAiNumRef = useRef<HandCricketNumber>(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Real-time live Hand Cricket number classification (0-6) from current finger bitmask
  const liveNumber = useMemo<HandCricketNumber | null>(() => {
    if (!live.detected || !cameraEnabled) return null;
    const [thumb, index, middle, ring, pinky] = live.fingerBitmask;
    return classifyHandCricketNumber({
      thumb,
      index,
      middle,
      ring,
      pinky,
      scores: [0, 0, 0, 0, 0],
    });
  }, [cameraEnabled, live.detected, live.fingerBitmask]);

  const playerRole: CricketRole = match.battingSide === "player" ? "Bat" : "Bowl";
  const aiRole: CricketRole = match.battingSide === "ai" ? "Bat" : "Bowl";

  const resetMatch = useCallback(
    (nextDiff: HandCricketDifficulty = difficulty, nextOvers: number | null = oversLimit) => {
      clearTimers();
      setCaptureActive(false);
      setDisplayedAiNum(null);
      setCaptureWarning(null);
      setMatch(createInitialHandCricketState(nextDiff, nextOvers));
    },
    [clearTimers, difficulty, oversLimit],
  );

  // Resolve a captured (or manually clicked) player number during Toss or Active Ball
  const commitPlayerNumber = useCallback(
    (playerNum: HandCricketNumber, fromToss: boolean) => {
      clearTimers();
      setCaptureActive(false);
      setCaptureWarning(null);

      const aiNum = lockedAiNumRef.current;
      setDisplayedAiNum(aiNum);

      const current = matchRef.current;

      if (fromToss) {
        const call = current.playerTossCall ?? "Odd";
        const tossOutcome = computeTossWinner(call, playerNum, aiNum);

        if (tossOutcome.winner === "player") {
          audio.playWin();
          setMatch({
            ...current,
            phase: "TOSS_DECISION",
            tossWinner: "player",
            lastTossPlayerNum: playerNum,
            lastTossAiNum: aiNum,
          });
        } else {
          audio.playLose();
          // AI chooses strategically (Medium/Hard tends to Bat First; Easy flips)
          const aiChoosesBat = current.difficulty === "easy" ? Math.random() > 0.4 : true;
          const firstBat: "player" | "ai" = aiChoosesBat ? "ai" : "player";
          setMatch({
            ...current,
            phase: "TOSS_RESULT",
            tossWinner: "ai",
            lastTossPlayerNum: playerNum,
            lastTossAiNum: aiNum,
            firstBattingSide: firstBat,
            battingSide: firstBat,
          });
          const id = window.setTimeout(() => {
            setDisplayedAiNum(null);
            setMatch((prev) =>
              prev.phase === "TOSS_RESULT" ? { ...prev, phase: "PLAY_READY" } : prev,
            );
          }, 1800);
          timersRef.current.push(id);
        }
        return;
      }

      const next = resolveCricketBall(current, playerNum, aiNum);
      setMatch(next);

      if (next.lastBall?.isOut) {
        audio.playLose();
      } else if (next.winner === "player") {
        audio.playWin();
      } else if (next.winner === "ai") {
        audio.playLose();
      } else if ((next.lastBall?.runsAdded ?? 0) >= 4) {
        audio.playWin();
      } else {
        audio.playShoot();
      }

      if (next.phase === "MATCH_OVER") {
        setSeriesScore((s) => ({
          player: s.player + (next.winner === "player" ? 1 : 0),
          ai: s.ai + (next.winner === "ai" ? 1 : 0),
          ties: s.ties + (next.winner === "tie" ? 1 : 0),
        }));
      }
    },
    [audio, clearTimers],
  );

  // Countdown + Camera Capture Loop (Locks AI number BEFORE seeing player's gesture!)
  const beginCountdown = useCallback(
    (isToss: boolean, overrideCall?: TossParity) => {
      clearTimers();
      setCaptureWarning(null);
      setDisplayedAiNum(null);

      const current = matchRef.current;
      const roleForAi: CricketRole = isToss
        ? "Bat"
        : current.battingSide === "ai"
          ? "Bat"
          : "Bowl";

      // Lock AI number STRICTLY BEFORE countdown capture completes!
      lockedAiNumRef.current = chooseAiHandCricketNumber({
        difficulty: current.difficulty,
        aiRole: roleForAi,
        playerHistory: current.playerHistory,
      });

      setMatch((prev) => ({
        ...prev,
        playerTossCall: overrideCall ?? prev.playerTossCall,
        phase: isToss ? "TOSS_COUNTDOWN" : "BALL_COUNTDOWN",
      }));

      setCountdownValue(3);
      audio.playTick();

      const t1 = window.setTimeout(() => {
        setCountdownValue(2);
        audio.playTick();
      }, 520);

      const t2 = window.setTimeout(() => {
        setCountdownValue(1);
        audio.playTick();
      }, 1040);

      const t3 = window.setTimeout(() => {
        setCountdownValue(0);
        setCaptureActive(true);
        audio.playShoot();

        const shootAt = performance.now();
        const votes = new Array<number>(7).fill(0);

        const pollCapture = () => {
          const elapsed = performance.now() - shootAt;
          const ev = visionBus.latest;

          if (ev && ev.timestampMs >= shootAt + 110 && ev.frame.detected) {
            const num = classifyHandCricketNumber(ev.frame.finger_states);
            if (num !== null) {
              votes[num] += 1;
            }
          }

          const totalVotes = votes.reduce((a, b) => a + b, 0);
          if (elapsed >= 380 && (totalVotes >= 2 || elapsed >= 820)) {
            if (totalVotes > 0) {
              let bestNum: HandCricketNumber = 0;
              let bestScore = -1;
              for (let i = 0; i <= 6; i++) {
                if (votes[i] > bestScore) {
                  bestScore = votes[i];
                  bestNum = i as HandCricketNumber;
                }
              }
              commitPlayerNumber(bestNum, isToss);
            } else {
              setCaptureActive(false);
              setCaptureWarning(
                "No clean 0–6 hand sign detected. Hold 0 (fist) to 6 (thumb up) clearly or tap a number below.",
              );
              setMatch((prev) => ({
                ...prev,
                phase: isToss ? "TOSS_CALL" : "PLAY_READY",
              }));
            }
            return;
          }

          const nextPoll = window.setTimeout(pollCapture, 45);
          timersRef.current.push(nextPoll);
        };

        const p0 = window.setTimeout(pollCapture, 130);
        timersRef.current.push(p0);
      }, 1560);

      timersRef.current.push(t1, t2, t3);
    },
    [audio, clearTimers, commitPlayerNumber],
  );

  // Start Ball or Auto-Next Ball flow
  useEffect(() => {
    if (match.phase === "BALL_REVEAL" && autoNextBall) {
      const id = window.setTimeout(() => {
        if (matchRef.current.phase === "BALL_REVEAL") {
          beginCountdown(false);
        }
      }, 1450);
      return () => window.clearTimeout(id);
    }
  }, [match.phase, autoNextBall, beginCountdown]);

  const handleTossCall = (parity: TossParity) => {
    if (!cameraEnabled || !camera.streamActive) {
      // Allow immediate lock if camera is off so player can tap manual 0-6 number
      lockedAiNumRef.current = chooseAiHandCricketNumber({
        difficulty,
        aiRole: "Bat",
        playerHistory: [],
      });
      setMatch((prev) => ({
        ...prev,
        playerTossCall: parity,
        phase: "TOSS_COUNTDOWN",
      }));
      setCaptureWarning("Camera is off — tap a number (0–6) below to toss.");
      return;
    }
    beginCountdown(true, parity);
  };

  const handleManualPick = (num: HandCricketNumber) => {
    const phase = match.phase;
    if (phase === "TOSS_CALL") {
      lockedAiNumRef.current = chooseAiHandCricketNumber({
        difficulty,
        aiRole: "Bat",
        playerHistory: [],
      });
      setMatch((prev) => ({ ...prev, playerTossCall: prev.playerTossCall ?? "Odd" }));
      commitPlayerNumber(num, true);
      return;
    }
    if (phase === "TOSS_COUNTDOWN") {
      commitPlayerNumber(num, true);
      return;
    }
    if (phase === "PLAY_READY" || phase === "BALL_REVEAL" || phase === "BALL_COUNTDOWN") {
      if (phase === "PLAY_READY" || phase === "BALL_REVEAL") {
        lockedAiNumRef.current = chooseAiHandCricketNumber({
          difficulty: match.difficulty,
          aiRole,
          playerHistory: match.playerHistory,
        });
      }
      commitPlayerNumber(num, false);
    }
  };

  const chooseTossBatBowl = (choice: CricketRole) => {
    const firstBat: "player" | "ai" = choice === "Bat" ? "player" : "ai";
    setDisplayedAiNum(null);
    setMatch((prev) => ({
      ...prev,
      firstBattingSide: firstBat,
      battingSide: firstBat,
      phase: "PLAY_READY",
    }));
  };

  const startSecondInnings = () => {
    setDisplayedAiNum(null);
    setCaptureWarning(null);
    setMatch((prev) => ({
      ...prev,
      innings: 2,
      battingSide: prev.battingSide === "player" ? "ai" : "player",
      phase: "PLAY_READY",
    }));
  };

  const isCountingDown =
    (match.phase === "TOSS_COUNTDOWN" || match.phase === "BALL_COUNTDOWN") &&
    cameraEnabled &&
    camera.streamActive;

  const currentRuns = match.innings === 1 ? match.innings1Runs : match.innings2Runs;
  const currentBalls = match.innings === 1 ? match.innings1Balls : match.innings2Balls;
  const runsNeeded =
    match.innings === 2 && match.target !== null
      ? Math.max(0, match.target - match.innings2Runs)
      : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 overflow-y-auto p-3 md:p-5">
      {/* Header & Configuration Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 shadow-xs backdrop-blur">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
            <span>🏏</span> Hand Cricket (0–6)
          </h2>
          <p className="text-[11px] text-slate-500">
            Thumb alone = 6 • Open palm = 5 • Closed fist = 0 • Match numbers to take a wicket!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Selector */}
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs">
            {(["easy", "medium", "hard"] as HandCricketDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDifficulty(d);
                  resetMatch(d, oversLimit);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold capitalize transition ${
                  difficulty === d
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Overs Limit Selector */}
          <select
            aria-label="Overs Limit"
            value={oversLimit ?? "unlimited"}
            onChange={(e) => {
              const val = e.target.value === "unlimited" ? null : Number(e.target.value);
              setOversLimit(val);
              resetMatch(difficulty, val);
            }}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="unlimited">Unlimited Overs</option>
            <option value="1">1 Over</option>
            <option value="2">2 Overs</option>
            <option value="5">5 Overs</option>
          </select>

          <button
            type="button"
            onClick={() => resetMatch()}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            New Match
          </button>
        </div>
      </div>

      {/* Main Arena Grid */}
      <div className="grid flex-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: Live Webcam Feed + Countdown + Gesture Legend / Keypad */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
            {cameraEnabled && camera.error ? (
              <CameraPermissionGuard
                error={camera.error}
                onRetry={() => void camera.startCamera(camera.activeDeviceId)}
              />
            ) : (
              <>
                <CameraPreview videoRef={videoRef} stream={camera.stream} mirror={mirror} />
                <HandSkeletonOverlay />
                <CountdownOverlay active={isCountingDown || captureActive} value={countdownValue} />
              </>
            )}

            {/* Top-left Live Number Readout */}
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/92 px-3 py-1.5 text-xs shadow-md backdrop-blur">
              <span className="text-slate-500">Your Sign:</span>
              <span className="font-bold text-sky-700">
                {liveNumber !== null
                  ? `${liveNumber} — ${HAND_CRICKET_LABELS[liveNumber]}`
                  : live.detected
                    ? "Hold Clean 0–6"
                    : "No Hand"}
              </span>
            </div>

            {/* Top-right Current Role Badge */}
            {match.firstBattingSide && (
              <div
                className={`absolute right-3 top-3 z-10 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur ${
                  playerRole === "Bat"
                    ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                    : "border-rose-200 bg-rose-50/95 text-rose-800"
                }`}
              >
                You: {playerRole === "Bat" ? "🏏 Batting" : "⚾ Bowling"}
              </div>
            )}
          </div>

          {/* Primary Play Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {(match.phase === "PLAY_READY" || match.phase === "BALL_REVEAL") && (
                <button
                  type="button"
                  onClick={() => beginCountdown(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-500"
                >
                  <Play className="h-3.5 w-3.5" />
                  {match.phase === "BALL_REVEAL" ? "Next Ball" : "Bowl Next Ball"}
                </button>
              )}

              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={autoNextBall}
                  onChange={(e) => setAutoNextBall(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Auto-Next Ball
              </label>
            </div>

            <CameraSelector camera={camera} compact />
          </div>

          {captureWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
              {captureWarning}
            </div>
          )}

          {/* 0–6 Official Gesture Reference & Optional Click Keypad */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-xs">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>0–6 Gesture Guide (or Click to Play Shot)</span>
              <span className="text-sky-600">Thumb Alone = 6</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {GESTURE_PILLS.map(({ num, icon, short }) => {
                const isLive = liveNumber === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleManualPick(num)}
                    className={`flex flex-col items-center rounded-xl border px-1 py-2 text-center transition ${
                      isLive
                        ? "border-sky-400 bg-sky-50 ring-2 ring-sky-300/60"
                        : "border-slate-200 bg-slate-50/70 hover:border-sky-300 hover:bg-white"
                    }`}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    <span className="mt-1 text-xs font-extrabold text-slate-900">{num}</span>
                    <span className="mt-0.5 text-[9px] font-medium text-slate-500">{short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: AI Opponent Visual + Toss / Innings UI + Live Cricket Scoreboard */}
        <div className="flex flex-col gap-3">
          {/* AI Opponent Card */}
          <div className="relative flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
            <div className="mb-1 flex w-full items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-widest text-slate-400">
                AI {match.firstBattingSide ? (aiRole === "Bat" ? "Batsman" : "Bowler") : "Opponent"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <ShieldCheck className="h-3 w-3" />
                Pre-Locked Fair AI
              </span>
            </div>

            <HandAnimation
              pose={isCountingDown ? "pumping" : "idle"}
              beat={countdownValue}
              fingerCount={
                !isCountingDown && displayedAiNum !== null ? displayedAiNum : undefined
              }
              dimZero={false}
              accent={
                match.lastBall?.isOut
                  ? "rose"
                  : (match.lastBall?.runsAdded ?? 0) >= 4
                    ? "emerald"
                    : "cyan"
              }
              sizeClass="h-44 w-44"
            />

            {/* Phase Interactive Controls */}
            {match.phase === "TOSS_CALL" && (
              <div className="mt-2 flex w-full flex-col items-center gap-2.5 text-center">
                <p className="text-sm font-bold text-slate-900">Coinless Toss — Call Odd or Even</p>
                <p className="text-xs text-slate-500">
                  Pick Odd or Even, then show 0–6 on camera (total parity decides the toss).
                </p>
                <div className="flex gap-3">
                  {(["Odd", "Even"] as TossParity[]).map((parity) => (
                    <button
                      key={parity}
                      type="button"
                      onClick={() => handleTossCall(parity)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-500"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Call {parity}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {match.phase === "TOSS_COUNTDOWN" && (
              <p className="mt-2 text-sm font-bold text-sky-700">
                Toss ({match.playerTossCall}) — Show your 0–6 hand at SHOOT!
              </p>
            )}

            {match.phase === "TOSS_RESULT" && (
              <div className="mt-2 text-center">
                <p className="text-sm font-bold text-rose-700">
                  AI won the toss ({match.lastTossPlayerNum} + {match.lastTossAiNum} ={" "}
                  {(match.lastTossPlayerNum ?? 0) + (match.lastTossAiNum ?? 0)})
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  AI elected to <strong>{match.firstBattingSide === "ai" ? "Bat" : "Bowl"}</strong>{" "}
                  first!
                </p>
              </div>
            )}

            {match.phase === "TOSS_DECISION" && (
              <div className="mt-2 flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-bold text-emerald-700">
                  You won the toss! ({match.lastTossPlayerNum} + {match.lastTossAiNum} ={" "}
                  {(match.lastTossPlayerNum ?? 0) + (match.lastTossAiNum ?? 0)} —{" "}
                  {match.playerTossCall})
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => chooseTossBatBowl("Bat")}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500"
                  >
                    🏏 Bat First
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseTossBatBowl("Bowl")}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    ⚾ Bowl First
                  </button>
                </div>
              </div>
            )}

            {match.phase === "BALL_COUNTDOWN" && (
              <p className="mt-2 text-sm font-bold text-sky-700">
                {playerRole === "Bat" ? "🏏 Swing at SHOOT!" : "⚾ Deliver ball at SHOOT!"}
              </p>
            )}

            {match.phase === "PLAY_READY" && !match.lastBall && (
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Innings {match.innings} Ready —{" "}
                {playerRole === "Bat" ? "You Bat, AI Bowls" : "AI Bats, You Bowl"}
              </p>
            )}

            {(match.phase === "BALL_REVEAL" ||
              match.phase === "INNINGS_BREAK" ||
              match.phase === "MATCH_OVER") &&
              match.lastBall && (
                <div className="mt-2 text-center">
                  <p
                    className={`text-base font-extrabold ${
                      match.lastBall.isOut
                        ? "text-rose-600"
                        : match.lastBall.runsAdded >= 4
                          ? "text-emerald-600"
                          : "text-slate-900"
                    }`}
                  >
                    {match.lastBall.isOut
                      ? `WICKET! Both showed ${match.lastBall.batsmanNum} — OUT!`
                      : `Batsman ${match.lastBall.batsmanNum} vs Bowler ${match.lastBall.bowlerNum} → +${match.lastBall.runsAdded} run${match.lastBall.runsAdded === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    AI showed {displayedAiNum ?? match.lastBall.bowlerNum} (
                    {HAND_CRICKET_LABELS[displayedAiNum ?? 0]})
                  </p>
                </div>
              )}

            {match.phase === "INNINGS_BREAK" && (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center">
                <p className="text-xs font-bold text-sky-900">
                  1st Innings Over! Score: {match.innings1Runs}/1 ({formatOvers(match.innings1Balls)}{" "}
                  ov) • Target: {match.target} runs
                </p>
                <button
                  type="button"
                  onClick={startSecondInnings}
                  className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-sky-500"
                >
                  Start 2nd Innings ({match.battingSide === "player" ? "AI Bats" : "You Bat"})
                </button>
              </div>
            )}

            {match.phase === "MATCH_OVER" && (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  {match.winner === "player"
                    ? "You Won the Match!"
                    : match.winner === "ai"
                      ? "AI Won the Match!"
                      : "Match Tied!"}
                </p>
                <p className="text-xs text-slate-600">
                  Final: {match.firstBattingSide === "player" ? "You" : "AI"} {match.innings1Runs} vs{" "}
                  {match.firstBattingSide === "player" ? "AI" : "You"} {match.innings2Runs}
                </p>
                <button
                  type="button"
                  onClick={() => resetMatch()}
                  className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-sky-500"
                >
                  Play Rematch
                </button>
              </div>
            )}
          </div>

          {/* Live Cricket Scoreboard & Ball-by-Ball Commentary */}
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Award className="h-4 w-4 text-sky-600" />
                Live Scoreboard
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Series: You {seriesScore.player} — {seriesScore.ai} AI
                {seriesScore.ties > 0 ? ` (${seriesScore.ties}T)` : ""}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                <p className="text-[10px] font-bold uppercase text-emerald-700">
                  Innings {match.innings}
                </p>
                <p className="text-xl font-black text-slate-900">
                  {currentRuns}/{match.innings === 1 ? (match.innings1Out ? 1 : 0) : match.innings2Out ? 1 : 0}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  Overs: {formatOvers(currentBalls)}
                </p>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-2.5">
                <p className="text-[10px] font-bold uppercase text-sky-700">Target</p>
                <p className="text-xl font-black text-slate-900">
                  {match.target ?? "—"}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {runsNeeded !== null ? `Need ${runsNeeded}` : "1st Innings"}
                </p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-2.5">
                <p className="text-[10px] font-bold uppercase text-indigo-700">Difficulty</p>
                <p className="text-lg font-black capitalize text-slate-900">{match.difficulty}</p>
                <p className="text-[10px] font-medium text-slate-500">
                  {match.oversLimit ? `${match.oversLimit} Ov` : "Unlimited"}
                </p>
              </div>
            </div>

            {/* Ball-by-Ball Timeline */}
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1 max-h-40">
              {match.ballLog.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">
                  Win or lose the toss to begin ball-by-ball commentary.
                </p>
              ) : (
                match.ballLog.map((b, i) => (
                  <div
                    key={`${b.innings}-${b.ballNumber}-${i}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <span className="font-medium text-slate-600">
                      Inn {b.innings} • Ball {b.ballNumber} ({b.battingSide === "player" ? "You" : "AI"} bat{" "}
                      {b.batsmanNum} vs {b.bowlerNum})
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 font-extrabold ${
                        b.isOut
                          ? "bg-rose-100 text-rose-700"
                          : b.runsAdded >= 6
                            ? "bg-indigo-100 text-indigo-700"
                            : b.runsAdded >= 4
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {b.isOut ? "OUT" : `+${b.runsAdded}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
