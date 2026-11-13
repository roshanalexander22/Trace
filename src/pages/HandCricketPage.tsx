import {
  Award,
  Coins,
  Play,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CameraPermissionGuard } from "../components/layout/CameraPermissionGuard";
import { CountdownOverlay } from "../components/rps/CountdownOverlay";
import { HandAnimation } from "../components/rps/HandAnimation";
import { CameraPreview } from "../components/vision/CameraPreview";
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
                "No clean 0–6 sign detected. Hold 0 (fist) to 6 (thumb up) clearly or tap a number below.",
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
    if (phase === "TOSS_CALL" || phase === "TOSS_COUNTDOWN") {
      if (phase === "TOSS_CALL") {
        lockedAiNumRef.current = chooseAiHandCricketNumber({
          difficulty,
          aiRole: "Bat",
          playerHistory: [],
        });
        setMatch((prev) => ({ ...prev, playerTossCall: prev.playerTossCall ?? "Odd" }));
      }
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
    <div
      className="h-full w-full overflow-y-auto p-4 sm:p-5 select-none"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      <div className="mx-auto max-w-7xl h-full flex flex-col gap-3">
        {/* Compact Mode Sub-bar (Difficulty & Overs) */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }}>Difficulty:</span>
            <div className="inline-flex rounded-lg border p-0.5" style={{ backgroundColor: "var(--bg-well)", borderColor: "var(--border-hairline)" }}>
              {(["easy", "medium", "hard"] as HandCricketDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDifficulty(d);
                    resetMatch(d, oversLimit);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize interactive-control ${
                    difficulty === d ? "shadow-2xs font-semibold" : ""
                  }`}
                  style={{
                    backgroundColor: difficulty === d ? "var(--bg-surface)" : "transparent",
                    color: difficulty === d ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }}>Overs:</span>
            <select
              aria-label="Overs Limit"
              value={oversLimit ?? "unlimited"}
              onChange={(e) => {
                const val = e.target.value === "unlimited" ? null : Number(e.target.value);
                setOversLimit(val);
                resetMatch(difficulty, val);
              }}
              className="px-2 py-0.5 rounded border text-[11px] font-medium outline-none cursor-pointer"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-primary)",
              }}
            >
              <option value="unlimited">Unlimited</option>
              <option value="1">1 Over</option>
              <option value="2">2 Overs</option>
              <option value="5">5 Overs</option>
            </select>

            <button
              type="button"
              onClick={() => resetMatch()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium interactive-control"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-secondary)",
              }}
            >
              <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
              <span>Reset Match</span>
            </button>
          </div>
        </div>

        {/* 58% / 42% Stage Grid */}
        <div className="grid flex-1 gap-4 lg:grid-cols-[1.38fr_1fr] min-h-0">
          {/* Left 58%: Rounded Camera Stage with Floating HUD Controls */}
          <div className="flex flex-col gap-3 min-w-0">
            <div
              className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden border shadow-sm"
              style={{
                backgroundColor: "var(--bg-well)",
                borderColor: "var(--border-hairline)",
              }}
            >
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

              {/* Top-Left Live Gesture Readout */}
              <div
                className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium backdrop-blur-md"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-hairline)",
                  color: "var(--text-primary)",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>Your Sign:</span>
                <span className="font-semibold" style={{ color: liveNumber !== null ? "var(--status-ready)" : "var(--text-primary)" }}>
                  {liveNumber !== null
                    ? `${liveNumber} — ${HAND_CRICKET_LABELS[liveNumber]}`
                    : live.detected
                      ? "Hold Clean 0–6"
                      : "No Hand"}
                </span>
              </div>

              {/* Top-Right Current Role Badge */}
              {match.firstBattingSide && (
                <div
                  className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg border text-xs font-semibold backdrop-blur-md"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    borderColor: "var(--border-hairline)",
                    color: playerRole === "Bat" ? "var(--status-ready)" : "var(--accent-primary)",
                  }}
                >
                  You: {playerRole === "Bat" ? "Batting" : "Bowling"}
                </div>
              )}

              {/* Floating Bottom HUD: Action Button + 0-6 Clickable Shot Pills */}
              <div
                className="absolute inset-x-3 bottom-3 z-20 flex flex-col gap-2 p-2.5 rounded-xl border backdrop-blur-md"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-hairline)",
                }}
              >
                {/* Controls Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {(match.phase === "PLAY_READY" || match.phase === "BALL_REVEAL") && (
                      <button
                        type="button"
                        onClick={() => beginCountdown(false)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold interactive-control"
                        style={{
                          backgroundColor: "var(--accent-primary)",
                          color: "var(--accent-contrast)",
                        }}
                      >
                        <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>{match.phase === "BALL_REVEAL" ? "Next Ball" : "Bowl Next Ball"}</span>
                      </button>
                    )}

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
                        checked={autoNextBall}
                        onChange={(e) => setAutoNextBall(e.target.checked)}
                        className="accent-[var(--accent-primary)] rounded w-3.5 h-3.5"
                      />
                      <span>Auto-Next</span>
                    </label>
                  </div>

                  <span className="hidden sm:inline-block text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                    Thumb alone = 6 · Palm = 5 · Fist = 0
                  </span>
                </div>

                {/* 0–6 Gesture / Keypad Strip */}
                <div className="grid grid-cols-7 gap-1 overflow-x-auto">
                  {GESTURE_PILLS.map(({ num, icon, short }) => {
                    const isLive = liveNumber === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleManualPick(num)}
                        className="flex flex-col items-center py-1.5 px-1 rounded-lg border interactive-control text-center"
                        style={{
                          backgroundColor: isLive ? "var(--accent-subtle)" : "var(--bg-well)",
                          borderColor: isLive ? "var(--accent-primary)" : "var(--border-hairline)",
                          color: isLive ? "var(--accent-primary)" : "var(--text-primary)",
                        }}
                      >
                        <span className="text-sm leading-none">{icon}</span>
                        <span className="mt-0.5 text-xs font-bold telemetry-value">{num}</span>
                        <span className="text-[8px] truncate max-w-full" style={{ color: "var(--text-secondary)" }}>
                          {short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {captureWarning && (
              <div
                className="p-2.5 rounded-xl border text-xs"
                style={{
                  backgroundColor: "var(--bg-well)",
                  borderColor: "var(--border-hairline)",
                  color: "var(--accent-primary)",
                }}
              >
                {captureWarning}
              </div>
            )}
          </div>

          {/* Right 42%: Opponent Stage + Scoreboard */}
          <div className="flex flex-col gap-3 min-w-0">
            {/* Opponent Card */}
            <div
              className="flex flex-col items-center justify-center p-4 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="flex w-full items-center justify-between text-xs mb-1">
                <span
                  className="text-[10px] font-bold tracking-wider uppercase"
                  style={{ color: "var(--text-secondary)" }}
                >
                  AI {match.firstBattingSide ? (aiRole === "Bat" ? "Batsman" : "Bowler") : "Opponent"}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                    color: "var(--status-ready)",
                  }}
                >
                  <ShieldCheck className="w-3 h-3" strokeWidth={1.5} />
                  <span>Pre-Locked Fair Move</span>
                </span>
              </div>

              <HandAnimation
                pose={isCountingDown ? "pumping" : "idle"}
                beat={countdownValue}
                fingerCount={!isCountingDown && displayedAiNum !== null ? displayedAiNum : undefined}
                dimZero={false}
                accent={
                  match.lastBall?.isOut
                    ? "rose"
                    : (match.lastBall?.runsAdded ?? 0) >= 4
                      ? "emerald"
                      : "cyan"
                }
                sizeClass="h-36 w-36"
              />

              {/* Toss / In-game Phase Controls */}
              {match.phase === "TOSS_CALL" && (
                <div className="mt-2 flex w-full flex-col items-center gap-2 text-center">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    Coinless Toss — Call Odd or Even
                  </p>
                  <div className="flex gap-2">
                    {(["Odd", "Even"] as TossParity[]).map((parity) => (
                      <button
                        key={parity}
                        type="button"
                        onClick={() => handleTossCall(parity)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold interactive-control"
                        style={{
                          backgroundColor: "var(--accent-primary)",
                          color: "var(--accent-contrast)",
                        }}
                      >
                        <Coins className="w-3.5 h-3.5" strokeWidth={1.5} />
                        <span>Call {parity}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {match.phase === "TOSS_COUNTDOWN" && (
                <p className="mt-2 text-xs font-semibold" style={{ color: "var(--accent-primary)" }}>
                  Toss ({match.playerTossCall}) — Show 0–6 at SHOOT!
                </p>
              )}

              {match.phase === "TOSS_RESULT" && (
                <div className="mt-2 text-center">
                  <p className="text-xs font-bold" style={{ color: "var(--accent-primary)" }}>
                    AI won the toss ({match.lastTossPlayerNum} + {match.lastTossAiNum} ={" "}
                    {(match.lastTossPlayerNum ?? 0) + (match.lastTossAiNum ?? 0)})
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    AI elected to <strong>{match.firstBattingSide === "ai" ? "Bat" : "Bowl"}</strong> first!
                  </p>
                </div>
              )}

              {match.phase === "TOSS_DECISION" && (
                <div className="mt-2 flex flex-col items-center gap-2 text-center">
                  <p className="text-xs font-bold" style={{ color: "var(--status-ready)" }}>
                    You won the toss! ({match.lastTossPlayerNum} + {match.lastTossAiNum} ={" "}
                    {(match.lastTossPlayerNum ?? 0) + (match.lastTossAiNum ?? 0)} — {match.playerTossCall})
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => chooseTossBatBowl("Bat")}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold interactive-control"
                      style={{
                        backgroundColor: "var(--status-ready)",
                        color: "#ffffff",
                      }}
                    >
                      Bat First
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseTossBatBowl("Bowl")}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold interactive-control"
                      style={{
                        backgroundColor: "var(--accent-primary)",
                        color: "var(--accent-contrast)",
                      }}
                    >
                      Bowl First
                    </button>
                  </div>
                </div>
              )}

              {(match.phase === "BALL_REVEAL" ||
                match.phase === "INNINGS_BREAK" ||
                match.phase === "MATCH_OVER") &&
                match.lastBall && (
                  <div className="mt-2 text-center">
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: match.lastBall.isOut
                          ? "var(--accent-primary)"
                          : match.lastBall.runsAdded >= 4
                            ? "var(--status-ready)"
                            : "var(--text-primary)",
                      }}
                    >
                      {match.lastBall.isOut
                        ? `WICKET! Both showed ${match.lastBall.batsmanNum} — OUT!`
                        : `Batsman ${match.lastBall.batsmanNum} vs Bowler ${match.lastBall.bowlerNum} → +${match.lastBall.runsAdded} run${match.lastBall.runsAdded === 1 ? "" : "s"}`}
                    </p>
                  </div>
                )}

              {match.phase === "INNINGS_BREAK" && (
                <div
                  className="mt-2.5 flex flex-col items-center gap-2 p-3 rounded-xl border text-center w-full"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                  }}
                >
                  <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    1st Innings Over: {match.innings1Runs}/1 ({formatOvers(match.innings1Balls)} ov) · Target: {match.target} runs
                  </p>
                  <button
                    type="button"
                    onClick={startSecondInnings}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold interactive-control"
                    style={{
                      backgroundColor: "var(--accent-primary)",
                      color: "var(--accent-contrast)",
                    }}
                  >
                    Start 2nd Innings ({match.battingSide === "player" ? "AI Bats" : "You Bat"})
                  </button>
                </div>
              )}

              {match.phase === "MATCH_OVER" && (
                <div
                  className="mt-2.5 flex flex-col items-center gap-2 p-3 rounded-xl border text-center w-full"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                  }}
                >
                  <p className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    <Trophy className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
                    {match.winner === "player"
                      ? "You Won the Match!"
                      : match.winner === "ai"
                        ? "AI Won the Match!"
                        : "Match Tied!"}
                  </p>
                  <button
                    type="button"
                    onClick={() => resetMatch()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold interactive-control"
                    style={{
                      backgroundColor: "var(--accent-primary)",
                      color: "var(--accent-contrast)",
                    }}
                  >
                    Play Rematch
                  </button>
                </div>
              )}
            </div>

            {/* Scoreboard Card */}
            <div
              className="flex flex-col gap-3 p-4 rounded-2xl border"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  <Award className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
                  <span>Match Scoreboard</span>
                </h3>
                <span className="telemetry-value text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Series: You {seriesScore.player} — {seriesScore.ai} AI
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  className="p-2 rounded-lg border"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--status-ready)" }}>
                    Innings {match.innings}
                  </p>
                  <p className="text-lg font-bold telemetry-value" style={{ color: "var(--text-primary)" }}>
                    {currentRuns}/{match.innings === 1 ? (match.innings1Out ? 1 : 0) : match.innings2Out ? 1 : 0}
                  </p>
                  <p className="text-[10px] telemetry-value" style={{ color: "var(--text-secondary)" }}>
                    Ov: {formatOvers(currentBalls)}
                  </p>
                </div>

                <div
                  className="p-2 rounded-lg border"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-secondary)" }}>
                    Target
                  </p>
                  <p className="text-lg font-bold telemetry-value" style={{ color: "var(--text-primary)" }}>
                    {match.target ?? "—"}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {runsNeeded !== null ? `Need ${runsNeeded}` : "1st Innings"}
                  </p>
                </div>

                <div
                  className="p-2 rounded-lg border"
                  style={{
                    backgroundColor: "var(--bg-well)",
                    borderColor: "var(--border-hairline)",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--text-secondary)" }}>
                    Mode
                  </p>
                  <p className="text-xs font-bold capitalize mt-1" style={{ color: "var(--text-primary)" }}>
                    {match.difficulty}
                  </p>
                  <p className="text-[10px] telemetry-value" style={{ color: "var(--text-secondary)" }}>
                    {match.oversLimit ? `${match.oversLimit} Ov` : "Unlimited"}
                  </p>
                </div>
              </div>

              {/* Ball-by-ball Timeline */}
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {match.ballLog.length === 0 ? (
                  <p className="py-3 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                    Ball-by-ball commentary appears here after toss.
                  </p>
                ) : (
                  match.ballLog.slice(0, 10).map((b, i) => (
                    <div
                      key={`${b.innings}-${b.ballNumber}-${i}`}
                      className="flex items-center justify-between p-1.5 px-2 rounded-lg border text-xs"
                      style={{
                        backgroundColor: "var(--bg-well)",
                        borderColor: "var(--border-hairline)",
                      }}
                    >
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        Inn {b.innings} · Ball {b.ballNumber} ({b.battingSide === "player" ? "You" : "AI"} {b.batsmanNum} vs {b.bowlerNum})
                      </span>
                      <span
                        className="font-bold telemetry-value text-[11px]"
                        style={{
                          color: b.isOut
                            ? "var(--accent-primary)"
                            : b.runsAdded >= 4
                              ? "var(--status-ready)"
                              : "var(--text-primary)",
                        }}
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
    </div>
  );
}
