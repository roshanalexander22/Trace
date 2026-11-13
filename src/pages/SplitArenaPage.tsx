import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, RotateCcw, Split as SplitIcon, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { HandAnimation } from "../components/rps/HandAnimation";
import { CameraPreview } from "../components/vision/CameraPreview";
import { HandSkeletonOverlay } from "../components/vision/HandSkeletonOverlay";
import {
  applySplitAction,
  canSplitHands,
  chooseBestAiSplitAction,
  createInitialSplitState,
  type SplitAction,
  type SplitState,
} from "../games/splitEngine";
import {
  WaveRestartDetector,
  areHandsTouchingForSplit,
  checkPlayerReadiness,
  findTouchedAiTarget,
  getHandContactPoints,
  type RectBox,
} from "../games/splitInteraction";
import type { CameraState } from "../hooks/useCamera";
import { useAppStore } from "../store/useAppStore";
import { mapVideoNormToViewport } from "../vision/coordinateMapper";
import { visionBus, type DetectedHandSummary } from "../vision/visionBus";

interface SplitArenaPageProps {
  camera: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

interface AiLungeState {
  handIdx: 0 | 1 | "both";
  dx: number;
  dy: number;
  phase: "lunging" | "returning";
  targetPlayerIdx?: 0 | 1;
}

const CONTACT_DWELL_MS = 160;
const SPLIT_TOUCH_DWELL_MS = 150;

export function SplitArenaPage({ camera, videoRef }: SplitArenaPageProps) {
  const mirror = useAppStore((s) => s.calibration.mirror_feed);
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const [game, setGame] = useState<SplitState>(() => createInitialSplitState());
  const [scores, setScores] = useState({ player: 0, ai: 0 });
  const [showRules, setShowRules] = useState(false);

  const [liveHands, setLiveHands] = useState<DetectedHandSummary[]>([]);
  const [touchProgress, setTouchProgress] = useState<{ target: 0 | 1 | null; pct: number }>({
    target: null,
    pct: 0,
  });
  const [splitProgress, setSplitProgress] = useState(0);
  const [waveProgress, setWaveProgress] = useState(0);

  const [statusMessage, setStatusMessage] = useState(
    "Show 1 finger on either hand and reach up to tap an AI hand!",
  );
  const [statusTone, setStatusTone] = useState<"info" | "warn" | "good" | "ai">("info");

  const [aiLunge, setAiLunge] = useState<AiLungeState | null>(null);
  const [tapFlash, setTapFlash] = useState<{ side: string; key: number } | null>(null);
  const [resetBanner, setResetBanner] = useState(false);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const aiLeftBoxRef = useRef<HTMLDivElement | null>(null);
  const aiRightBoxRef = useRef<HTMLDivElement | null>(null);
  const playerLeftAnchorRef = useRef<HTMLDivElement | null>(null);
  const playerRightAnchorRef = useRef<HTMLDivElement | null>(null);

  const gameRef = useRef(game);
  gameRef.current = game;
  const aiAnimatingRef = useRef(false);
  const latestHandsRef = useRef<DetectedHandSummary[]>([]);
  const latestVideoSizeRef = useRef({ w: 640, h: 480 });

  const hoverRef = useRef<{ attacker: 0 | 1; target: 0 | 1; sinceMs: number } | null>(null);
  const splitHoverSinceRef = useRef<number | null>(null);
  const lastSplitTouchMsRef = useRef<number>(0);
  const waveDetectorRef = useRef(new WaveRestartDetector());

  const playTapSfx = useCallback(
    (kind: "tap" | "split" | "out" | "win" | "reset") => {
      if (!soundEnabled) return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

        if (kind === "win") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25);
        } else if (kind === "out") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(98, now + 0.24);
        } else if (kind === "reset") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
        } else if (kind === "split") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(493.88, now);
          osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.14);
        } else {
          osc.type = "sine";
          osc.frequency.setValueAtTime(560, now);
          osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);
        }

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.start(now);
        osc.stop(now + 0.27);
      } catch {
        // Ignore browser autoplay restrictions
      }
    },
    [soundEnabled],
  );

  const resetMatch = useCallback(
    (viaWave = false) => {
      hoverRef.current = null;
      splitHoverSinceRef.current = null;
      waveDetectorRef.current.reset();
      aiAnimatingRef.current = false;
      setAiLunge(null);
      setTouchProgress({ target: null, pct: 0 });
      setSplitProgress(0);
      setWaveProgress(0);
      setGame(createInitialSplitState());
      setStatusTone(viaWave ? "good" : "info");
      setStatusMessage(
        viaWave
          ? "Two-hand wave detected — match reset to 1 - 1 vs 1 - 1!"
          : "New match started (1 - 1 vs 1 - 1). Your turn!",
      );
      if (viaWave) {
        playTapSfx("reset");
        setResetBanner(true);
        window.setTimeout(() => setResetBanner(false), 1600);
      }
    },
    [playTapSfx],
  );

  const commitPlayerAction = useCallback(
    (action: SplitAction) => {
      const current = gameRef.current;
      if (current.turn !== "Player" || current.winner || aiAnimatingRef.current) return;

      try {
        const next = applySplitAction(current, action);
        setGame(next);
        hoverRef.current = null;
        splitHoverSinceRef.current = null;
        setTouchProgress({ target: null, pct: 0 });
        setSplitProgress(0);

        if (action.type === "attack") {
          const prevTargetVal = current.ai[action.to];
          const nextTargetVal = next.ai[action.to];
          setTapFlash({ side: `ai-${action.to}`, key: Date.now() });
          playTapSfx(nextTargetVal === 0 && prevTargetVal > 0 ? "out" : "tap");
          setStatusTone("good");
          setStatusMessage(
            nextTargetVal === 0 && prevTargetVal > 0
              ? `Direct hit! AI ${action.to === 0 ? "Left" : "Right"} hit 5 and is OUT!`
              : `Tapped AI ${action.to === 0 ? "Left" : "Right"} (+${current.player[action.from]}) → ${nextTargetVal}`,
          );
        } else {
          setTapFlash({ side: "player-both", key: Date.now() });
          playTapSfx("split");
          setStatusTone("good");
          setStatusMessage(
            `Split complete! ${current.player[0]} - ${current.player[1]} → ${next.player[0]} - ${next.player[1]}`,
          );
        }

        if (next.winner === "Player") {
          setScores((s) => ({ ...s, player: s.player + 1 }));
          playTapSfx("win");
          setStatusTone("good");
          setStatusMessage("You eliminated both AI hands! You win!");
        }
      } catch {
        // Ignore invalid action race
      }
    },
    [playTapSfx],
  );

  // Helper to read DOM box relative to the arena container
  const toRelativeRect = useCallback((el: HTMLElement | null): RectBox | null => {
    const arena = arenaRef.current;
    if (!arena || !el) return null;
    const a = arena.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return {
      left: b.left - a.left,
      top: b.top - a.top,
      right: b.right - a.left,
      bottom: b.bottom - a.top,
    };
  }, []);

  // Real-time dual-hand coordinate interaction loop via visionBus
  useEffect(() => {
    const unsub = visionBus.subscribe((ev) => {
      if (!cameraEnabled) {
        setLiveHands([]);
        setTouchProgress({ target: null, pct: 0 });
        setSplitProgress(0);
        setWaveProgress(0);
        return;
      }

      const hands = ev.hands ?? [];
      latestHandsRef.current = hands;
      latestVideoSizeRef.current = {
        w: ev.metrics.videoWidth || 640,
        h: ev.metrics.videoHeight || 480,
      };
      setLiveHands(hands);

      const now = ev.timestampMs || performance.now();

      // 1. Check sustained two-hand waving gesture for match restart (works anytime)
      const wave = waveDetectorRef.current.update(hands, now);
      setWaveProgress(wave.progress);
      if (wave.triggered) {
        resetMatch(true);
        return;
      }

      const current = gameRef.current;
      if (current.winner || current.turn !== "Player" || aiAnimatingRef.current) {
        hoverRef.current = null;
        splitHoverSinceRef.current = null;
        setTouchProgress({ target: null, pct: 0 });
        setSplitProgress(0);
        return;
      }

      const arena = arenaRef.current;
      if (!arena) return;
      const viewW = arena.clientWidth;
      const viewH = arena.clientHeight;
      if (viewW === 0 || viewH === 0) return;

      // 2. Check physical two-hand join for legal Split (when 2-0 or 4-0)
      const handsJoined = areHandsTouchingForSplit(
        hands,
        current,
        latestVideoSizeRef.current.w,
        latestVideoSizeRef.current.h,
        viewW,
        viewH,
      );
      // Tolerate brief 1-hand occlusion at the moment palms clap together
      const occludedMidJoin =
        !handsJoined &&
        splitHoverSinceRef.current !== null &&
        now - lastSplitTouchMsRef.current <= 400 &&
        hands.length >= 1;

      if (handsJoined) {
        lastSplitTouchMsRef.current = now;
      }

      if (handsJoined || occludedMidJoin) {
        if (!splitHoverSinceRef.current) {
          splitHoverSinceRef.current = now;
        }
        const elapsed = now - splitHoverSinceRef.current;
        setSplitProgress(Math.min(1, elapsed / SPLIT_TOUCH_DWELL_MS));
        if (elapsed >= SPLIT_TOUCH_DWELL_MS) {
          commitPlayerAction({ type: "split" });
          return;
        }
      } else {
        splitHoverSinceRef.current = null;
        setSplitProgress(0);
      }

      // 3. Strict Player Readiness Check:
      // Both hands must be on screen and show exact finger counts if both are alive.
      // If one hand is OUT, it may be offscreen, but the active hand must be on screen and match.
      const readiness = checkPlayerReadiness(hands, current.player);

      if (!readiness.canTap) {
        hoverRef.current = null;
        setTouchProgress({ target: null, pct: 0 });
        setStatusTone(
          readiness.status === "need_both_hands" || readiness.status === "need_active_hand"
            ? "info"
            : "warn",
        );
        setStatusMessage(readiness.message);
        return;
      }

      // 4. Coordinate-accurate tap detection against rendered AI Left / AI Right hitboxes
      const aiLeftBox = toRelativeRect(aiLeftBoxRef.current);
      const aiRightBox = toRelativeRect(aiRightBoxRef.current);

      let matchedTouch: { attacker: 0 | 1; target: 0 | 1 } | null = null;

      // Candidate attacking hands: only check hands that are active in the game
      const candidateAttackers: Array<{ hand: DetectedHandSummary; index: 0 | 1 }> = [];
      if (readiness.leftHand && current.player[0] > 0) {
        candidateAttackers.push({ hand: readiness.leftHand, index: 0 });
      }
      if (readiness.rightHand && current.player[1] > 0) {
        candidateAttackers.push({ hand: readiness.rightHand, index: 1 });
      }

      for (const { hand, index } of candidateAttackers) {
        const contactPts = getHandContactPoints(
          hand.landmarks,
          latestVideoSizeRef.current.w,
          latestVideoSizeRef.current.h,
          viewW,
          viewH,
          "cover",
        );
        const touchedAi = findTouchedAiTarget(contactPts, aiLeftBox, aiRightBox, current.ai);
        if (touchedAi !== null) {
          matchedTouch = { attacker: index, target: touchedAi };
          break;
        }
      }

      if (matchedTouch) {
        const prevHover = hoverRef.current;
        if (
          prevHover &&
          prevHover.attacker === matchedTouch.attacker &&
          prevHover.target === matchedTouch.target
        ) {
          const elapsed = now - prevHover.sinceMs;
          setTouchProgress({
            target: matchedTouch.target,
            pct: Math.min(1, elapsed / CONTACT_DWELL_MS),
          });
          if (elapsed >= CONTACT_DWELL_MS) {
            commitPlayerAction({
              type: "attack",
              from: matchedTouch.attacker,
              to: matchedTouch.target,
            });
          }
        } else {
          hoverRef.current = {
            attacker: matchedTouch.attacker,
            target: matchedTouch.target,
            sinceMs: now,
          };
          setTouchProgress({ target: matchedTouch.target, pct: 0.15 });
        }
      } else {
        hoverRef.current = null;
        setTouchProgress({ target: null, pct: 0 });
        setStatusTone("good");
        setStatusMessage(readiness.message);
      }
    });

    return () => unsub();
  }, [cameraEnabled, commitPlayerAction, resetMatch, toRelativeRect]);

  // Animated AI Turn: choose move -> lunge AI hand physically to player's hand -> apply score -> return
  useEffect(() => {
    if (game.turn !== "Ai" || game.winner) return;

    let cancelled = false;
    aiAnimatingRef.current = true;
    setStatusTone("ai");
    setStatusMessage("AI is planning its tap...");

    const timers: number[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    schedule(() => {
      const action = chooseBestAiSplitAction(gameRef.current);
      if (!action) {
        aiAnimatingRef.current = false;
        return;
      }

      const arena = arenaRef.current;
      if (action.type === "split") {
        setStatusMessage("AI brings its hands together to Split...");
        setAiLunge({ handIdx: "both", dx: 64, dy: 0, phase: "lunging" });

        schedule(() => {
          const next = applySplitAction(gameRef.current, action);
          setGame(next);
          playTapSfx("split");
          setTapFlash({ side: "ai-split", key: Date.now() });
          setAiLunge({ handIdx: "both", dx: 0, dy: 0, phase: "returning" });
          setStatusTone("info");
          setStatusMessage(`AI split to ${next.ai[0]} - ${next.ai[1]}. Your turn!`);

          schedule(() => {
            setAiLunge(null);
            aiAnimatingRef.current = false;
          }, 360);
        }, 420);
        return;
      }

      // Attack lunge toward targeted player hand coordinate (live hand or bottom anchor)
      const attackerEl = action.from === 0 ? aiLeftBoxRef.current : aiRightBoxRef.current;
      const targetAnchorEl =
        action.to === 0 ? playerLeftAnchorRef.current : playerRightAnchorRef.current;

      let dx = action.to === action.from ? 0 : action.to === 0 ? -160 : 160;
      let dy = 240;

      if (arena && attackerEl) {
        const aRect = arena.getBoundingClientRect();
        const fromRect = attackerEl.getBoundingClientRect();
        const fromCx = fromRect.left - aRect.left + fromRect.width / 2;
        const fromCy = fromRect.top - aRect.top + fromRect.height / 2;

        const slotName = action.to === 0 ? "Left" : "Right";
        const trackedHand = latestHandsRef.current.find((h) => h.slot === slotName);

        let toCx: number;
        let toCy: number;

        if (trackedHand && trackedHand.landmarks.length >= 21) {
          const lm = trackedHand.landmarks[9];
          const mapped = mapVideoNormToViewport(
            lm.x,
            lm.y,
            latestVideoSizeRef.current.w,
            latestVideoSizeRef.current.h,
            aRect.width,
            aRect.height,
            "cover",
          );
          toCx = mapped.x;
          toCy = mapped.y;
        } else if (targetAnchorEl) {
          const tRect = targetAnchorEl.getBoundingClientRect();
          toCx = tRect.left - aRect.left + tRect.width / 2;
          toCy = tRect.top - aRect.top - 40;
        } else {
          toCx = aRect.width * (action.to === 0 ? 0.28 : 0.72);
          toCy = aRect.height * 0.74;
        }

        dx = toCx - fromCx;
        dy = toCy - fromCy;
      }

      const aiSide = action.from === 0 ? "Left" : "Right";
      const playerSide = action.to === 0 ? "Left" : "Right";
      setStatusMessage(`AI ${aiSide} hand (${gameRef.current.ai[action.from]}) reaches to tap Your ${playerSide}...`);
      setAiLunge({
        handIdx: action.from,
        dx,
        dy,
        phase: "lunging",
        targetPlayerIdx: action.to,
      });

      schedule(() => {
        const currentBefore = gameRef.current;
        const next = applySplitAction(currentBefore, action);
        const newVal = next.player[action.to];

        setGame(next);
        setTapFlash({ side: `player-${action.to}`, key: Date.now() });
        playTapSfx(newVal === 0 ? "out" : "tap");
        setAiLunge({
          handIdx: action.from,
          dx: 0,
          dy: 0,
          phase: "returning",
          targetPlayerIdx: action.to,
        });

        if (next.winner === "Ai") {
          setScores((s) => ({ ...s, ai: s.ai + 1 }));
          playTapSfx("win");
          setStatusTone("warn");
          setStatusMessage("AI eliminated both of your hands! Wave both hands or click Play Again.");
        } else {
          setStatusTone("info");
          setStatusMessage(
            newVal === 0
              ? `AI tapped Your ${playerSide} → hit 5 (OUT)! Show your active hand count to counter.`
              : `AI tapped Your ${playerSide} → now ${newVal} finger${newVal === 1 ? "" : "s"}. Your turn!`,
          );
        }

        schedule(() => {
          setAiLunge(null);
          aiAnimatingRef.current = false;
        }, 380);
      }, 480);
    }, 360);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      aiAnimatingRef.current = false;
    };
  }, [game.turn, game.winner, playTapSfx]);

  // Compute live validation & readiness for player hands
  const readiness = useMemo(
    () => checkPlayerReadiness(liveHands, game.player),
    [liveHands, game.player],
  );

  const playerCanSplit = game.turn === "Player" && !game.winner && canSplitHands(game.player);

  return (
    <div
      className="relative flex h-full w-full flex-col select-none overflow-hidden"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      {/* Full-Bleed Interactive Camera Arena */}
      <div
        ref={arenaRef}
        className="relative flex-1 w-full h-full overflow-hidden"
        style={{ backgroundColor: "var(--bg-well)" }}
      >
        {/* Fullscreen Webcam Layer */}
        <div className="absolute inset-0">
          <CameraPreview videoRef={videoRef} stream={camera.stream} mirror={mirror} fit="cover" />
        </div>

        {/* Subtle Top & Bottom Gradient Scrims for Crisp HUD Readability */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/45 via-black/15 to-transparent"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        />

        {/* Floating Top Bar Inside Stage: Score Pill Centered, Rules + Restart Pinned Top-Right */}
        <div className="absolute inset-x-4 top-3 z-20 flex items-center justify-between pointer-events-none">
          {/* Left Title Pill */}
          <div
            className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md text-xs font-semibold"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-hairline)",
            }}
          >
            <SplitIcon className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: "var(--accent-primary)" }} />
            <span>Split</span>
          </div>

          {/* Centered Translucent Score Pill */}
          <div
            className="pointer-events-auto inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border backdrop-blur-md text-xs font-bold shadow-sm"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-hairline)",
            }}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
            <span className="telemetry-value" style={{ color: "var(--status-ready)" }}>You {scores.player}</span>
            <span style={{ color: "var(--text-secondary)", opacity: 0.6 }}>—</span>
            <span className="telemetry-value" style={{ color: "var(--accent-primary)" }}>{scores.ai} AI</span>
            <span style={{ color: "var(--text-secondary)", opacity: 0.6 }}>·</span>
            <span
              className="text-[11px] font-semibold"
              style={{
                color: game.winner
                  ? "var(--text-primary)"
                  : game.turn === "Player"
                    ? "var(--status-ready)"
                    : "var(--accent-primary)",
              }}
            >
              {game.winner
                ? game.winner === "Player"
                  ? "You Won!"
                  : "AI Won!"
                : game.turn === "Player"
                  ? "Your Turn"
                  : "AI Turn"}
            </span>
          </div>

          {/* Right Pinned Rules & Restart Buttons */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowRules((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-md interactive-control"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-secondary)",
              }}
            >
              <BookOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Rules</span>
            </button>

            <button
              type="button"
              onClick={() => resetMatch(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-md interactive-control"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-secondary)",
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Restart</span>
            </button>
          </div>
        </div>

        {/* Non-Blocking Slide-Over Rules Drawer */}
        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 right-4 z-30 max-w-md p-4 rounded-2xl border text-xs shadow-xl backdrop-blur-md"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-primary)",
              }}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b" style={{ borderColor: "var(--border-hairline)" }}>
                <span className="font-bold text-xs">Official Split (Chopsticks) Rules</span>
                <button
                  type="button"
                  onClick={() => setShowRules(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 leading-relaxed text-[11px]" style={{ color: "var(--text-secondary)" }}>
                <p>
                  <strong style={{ color: "var(--text-primary)" }}>1. Tap to Add:</strong> Show the exact finger count on either hand, then reach up to tap an AI hand.
                </p>
                <p>
                  <strong style={{ color: "var(--text-primary)" }}>2. Exact 5 & Rollover:</strong> Reaching 5 is OUT (0). Over 5 rolls over (6→1, 7→2, 8→3).
                </p>
                <p>
                  <strong style={{ color: "var(--text-primary)" }}>3. Split (Revive):</strong> When one hand is 0 and the other is 2 or 4, join both hands together to split evenly (2-0 → 1-1, 4-0 → 2-2).
                </p>
                <p>
                  <strong style={{ color: "var(--text-primary)" }}>4. Wave to Reset:</strong> Raise both hands and wave side-to-side to restart match anytime.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera Error Guard (only when camera is intentionally enabled) */}
        {cameraEnabled && camera.error && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-rose-600">{camera.error.message}</p>
            <button
              type="button"
              onClick={() => void camera.startCamera()}
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500"
            >
              Retry Camera
            </button>
          </div>
        )}

        {/* TOP SECTION: Two Downward-Facing Animated AI Hands */}
        <div className="absolute inset-x-0 top-14 z-20 flex items-start justify-around px-6 pointer-events-none sm:px-24">
          {([0, 1] as const).map((aiIdx) => {
            const count = game.ai[aiIdx];
            const isOut = count === 0;
            const isTargetHovered = touchProgress.target === aiIdx;
            const lunging =
              aiLunge?.handIdx === aiIdx
                ? { x: aiLunge.dx, y: aiLunge.dy, scale: aiLunge.phase === "lunging" ? 1.12 : 1 }
                : aiLunge?.handIdx === "both"
                  ? {
                      x: aiIdx === 0 ? aiLunge.dx : -aiLunge.dx,
                      y: 0,
                      scale: 1.05,
                    }
                  : { x: 0, y: 0, scale: 1 };

            return (
              <motion.div
                key={aiIdx}
                ref={aiIdx === 0 ? aiLeftBoxRef : aiRightBoxRef}
                animate={lunging}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                onClick={() => {
                  // Click fallback if player hands are ready and valid
                  if (game.turn !== "Player" || isOut || aiAnimatingRef.current) return;
                  const currentReadiness = checkPlayerReadiness(latestHandsRef.current, game.player);
                  if (!currentReadiness.canTap) {
                    setStatusTone(
                      currentReadiness.status === "need_both_hands" || currentReadiness.status === "need_active_hand"
                        ? "info"
                        : "warn",
                    );
                    setStatusMessage(currentReadiness.message);
                    return;
                  }
                  const preferredAttacker: 0 | 1 =
                    currentReadiness.leftHand && currentReadiness.leftMatches && game.player[0] > 0
                      ? 0
                      : 1;
                  commitPlayerAction({
                    type: "attack",
                    from: preferredAttacker,
                    to: aiIdx,
                  });
                }}
                className={`pointer-events-auto group relative flex cursor-pointer flex-col items-center rounded-3xl border px-5 py-3 shadow-xl backdrop-blur-md transition-all ${
                  isOut
                    ? "opacity-50"
                    : isTargetHovered
                      ? "ring-4 shadow-2xl scale-105"
                      : "shadow-md hover:scale-102"
                }`}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: isTargetHovered
                    ? "var(--status-ready)"
                    : isOut
                      ? "var(--border-hairline)"
                      : "rgba(240, 100, 59, 0.4)",
                }}
              >
                {/* Upright AI Hand Label & Count Badge */}
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    AI {aiIdx === 0 ? "Left" : "Right"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                      isOut
                        ? "bg-slate-300 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300"
                        : "bg-rose-600 text-white shadow-xs"
                    }`}
                  >
                    {isOut ? "OUT (5)" : `${count} Finger${count === 1 ? "" : "s"}`}
                  </span>
                </div>

                {/* Animated AI Hand oriented downward toward the player */}
                <HandAnimation
                  pose={isOut ? "Rock" : "idle"}
                  fingerCount={count as 0 | 1 | 2 | 3 | 4}
                  accent={isOut ? "amber" : isTargetHovered ? "emerald" : "rose"}
                  facing="down"
                  mirrored={aiIdx === 1}
                  sizeClass="h-28 w-28 sm:h-36 sm:w-36"
                />

                {/* Tap Hold Progress Bar when Player's Physical Hand Enters Target */}
                {isTargetHovered && (
                  <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${Math.round(touchProgress.pct * 100)}%` }}
                    />
                  </div>
                )}

                {/* Impact Ring on Tap */}
                {tapFlash?.side === `ai-${aiIdx}` && (
                  <motion.div
                    key={tapFlash.key}
                    initial={{ scale: 0.7, opacity: 0.9 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 0.45 }}
                    className="pointer-events-none absolute inset-0 rounded-3xl border-4 border-emerald-400"
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* MIDDLE INTERACTION ZONE: Status Banner, Split Action Pill & Two-Hand Wave Progress */}
        <div className="pointer-events-none absolute inset-x-0 top-60 z-20 flex flex-col items-center gap-2 px-4 sm:top-72">
          <div
            className={`max-w-xl rounded-2xl border px-4 py-2 text-center text-xs font-semibold shadow-md backdrop-blur-md sm:text-sm ${
              statusTone === "warn"
                ? "border-amber-400 bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : statusTone === "good"
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : statusTone === "ai"
                    ? "border-rose-400 bg-rose-500/15 text-rose-600 dark:text-rose-300"
                    : "border-slate-300 bg-white/90 text-slate-800 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100"
            }`}
          >
            {statusMessage}
          </div>

          {playerCanSplit && (
            <button
              type="button"
              onClick={() => commitPlayerAction({ type: "split" })}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-sky-400 bg-white/95 dark:bg-zinc-900/95 px-5 py-2.5 text-xs font-bold text-sky-700 dark:text-sky-300 shadow-xl ring-2 ring-sky-300/50 backdrop-blur-md transition hover:bg-sky-50 dark:hover:bg-zinc-800 active:scale-95"
            >
              <SplitIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>
                Join Both Hands to Split ({game.player[0]} - {game.player[1]} →{" "}
                {Math.floor((game.player[0] + game.player[1]) / 2)} -{" "}
                {Math.ceil((game.player[0] + game.player[1]) / 2)})
              </span>
              {splitProgress > 0 && (
                <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                  {Math.round(splitProgress * 100)}%
                </span>
              )}
            </button>
          )}

          {(waveProgress > 0 || resetBanner) && (
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-300 bg-white/95 dark:bg-zinc-900/95 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-md backdrop-blur-md">
              <span>
                {resetBanner
                  ? "Match Reset!"
                  : `Keep waving hands to reset (${Math.round(waveProgress * 100)}%)`}
              </span>
              {!resetBanner && (
                <div className="h-2 w-24 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-75"
                    style={{ width: `${Math.round(waveProgress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: Player Left & Right Live Validation & Finger-Count HUD */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-end justify-between px-4 sm:bottom-4 sm:px-10">
          {([0, 1] as const).map((idx) => {
            const gameCount = game.player[idx];
            const isOut = gameCount === 0;
            const live = idx === 0 ? readiness.leftHand : readiness.rightHand;
            const isMatching = idx === 0 ? readiness.leftMatches : readiness.rightMatches;
            const isAiTargeted =
              aiLunge?.targetPlayerIdx === idx && aiLunge?.phase === "lunging";
            const slotColor = idx === 0 ? "sky" : "violet";

            return (
              <div
                key={idx}
                ref={idx === 0 ? playerLeftAnchorRef : playerRightAnchorRef}
                className={`relative flex flex-col gap-1 rounded-2xl border px-3.5 py-2.5 backdrop-blur-md transition sm:min-w-[205px] ${
                  isOut
                    ? "border-slate-300/80 bg-white/75 dark:bg-zinc-900/75 opacity-70"
                    : isMatching
                      ? "border-emerald-400 bg-white/92 dark:bg-zinc-900/92 ring-2 ring-emerald-400/40 shadow-lg"
                      : !live
                        ? "border-amber-400 bg-amber-50/95 dark:bg-amber-950/40 ring-2 ring-amber-400/35 shadow-md"
                        : "border-rose-400 bg-rose-50/95 dark:bg-rose-950/40 ring-2 ring-rose-400/35 shadow-md"
                } ${isAiTargeted ? "ring-4 ring-rose-500/60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      slotColor === "sky"
                        ? "text-sky-700 dark:text-sky-300"
                        : "text-violet-700 dark:text-violet-300"
                    }`}
                  >
                    Your {idx === 0 ? "Left" : "Right"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                      isOut
                        ? "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                        : slotColor === "sky"
                          ? "bg-sky-600 text-white"
                          : "bg-violet-600 text-white"
                    }`}
                  >
                    {isOut ? "OUT (5)" : `${gameCount} Finger${gameCount === 1 ? "" : "s"}`}
                  </span>
                </div>

                <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                  {isOut ? (
                    "Hand eliminated (can be off-screen)"
                  ) : !live ? (
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      Missing from view — raise hand!
                    </span>
                  ) : isMatching ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Detected {live.fingerCount} ✓ Ready to tap
                    </span>
                  ) : (
                    <span className="font-semibold text-rose-700 dark:text-rose-300">
                      Saw {live.fingerCount} — show {gameCount} to tap
                    </span>
                  )}
                </div>

                {/* Flash Ring when AI Taps This Player Hand or Player Completes a Split */}
                {(tapFlash?.side === `player-${idx}` || tapFlash?.side === "player-both") && (
                  <motion.div
                    key={tapFlash.key}
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: 1.35, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`pointer-events-none absolute inset-0 rounded-2xl border-4 ${
                      tapFlash.side === "player-both" ? "border-emerald-500" : "border-rose-500"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Dual-Hand Landmark & Skeleton Overlay (above AI hand cards so touch alignment is visible) */}
        <HandSkeletonOverlay className="z-[15]" showBadges fit="cover" />

        {/* Subtle Two-Hand Wave Hint Pill in Bottom Center */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 hidden justify-center md:flex">
          <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-xs backdrop-blur-sm">
            Wave both hands side-to-side to restart match
          </span>
        </div>

        {/* Match Finished Overlay */}
        {game.winner && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  game.winner === "Player"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {game.winner === "Player" ? "Victory!" : "AI Takes This Match"}
              </h3>
              <p className="text-xs text-slate-600">
                {game.winner === "Player"
                  ? "Both AI hands reached an exact total of 5."
                  : "Both of your hands were eliminated. Ready for a rematch?"}
              </p>
              <button
                type="button"
                onClick={() => resetMatch(false)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-500"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Play Again
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
