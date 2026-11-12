import { canSplitHands, type SplitState } from "./splitEngine";
import type { Point3 } from "../platform/types";
import { mapVideoNormToViewport, type MappedPoint } from "../vision/coordinateMapper";
import type { DetectedHandSummary } from "../vision/visionBus";

export interface RectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type HandValidationStatus = "matched" | "mismatch" | "eliminated";

export interface HandValidationResult {
  status: HandValidationStatus;
  handIndex: 0 | 1;
  expectedCount: number;
  detectedCount: number;
  message: string;
}

const CONTACT_LANDMARK_INDICES = [8, 12, 9] as const;

export function getHandContactPoints(
  landmarks: Point3[],
  videoWidth: number,
  videoHeight: number,
  viewWidth: number,
  viewHeight: number,
  fit: "cover" | "contain" = "cover",
): MappedPoint[] {
  if (landmarks.length < 21) return [];
  return CONTACT_LANDMARK_INDICES.map((idx) => {
    const lm = landmarks[idx];
    return mapVideoNormToViewport(
      lm.x,
      lm.y,
      videoWidth,
      videoHeight,
      viewWidth,
      viewHeight,
      fit,
    );
  });
}

export function pointInBox(pt: MappedPoint, box: RectBox, pad = 6): boolean {
  return (
    pt.x >= box.left - pad &&
    pt.x <= box.right + pad &&
    pt.y >= box.top - pad &&
    pt.y <= box.bottom + pad
  );
}

/**
 * Checks whether any contact landmark of the player's attacking hand physically intersects
 * either active AI hand target box in viewport coordinates.
 */
export function findTouchedAiTarget(
  contactPoints: MappedPoint[],
  aiLeftBox: RectBox | null,
  aiRightBox: RectBox | null,
  aiCounts: [number, number],
): 0 | 1 | null {
  for (const pt of contactPoints) {
    if (aiCounts[0] > 0 && aiLeftBox && pointInBox(pt, aiLeftBox)) {
      return 0;
    }
    if (aiCounts[1] > 0 && aiRightBox && pointInBox(pt, aiRightBox)) {
      return 1;
    }
  }
  return null;
}

/**
 * Validates that the player's physical hand currently displays the exact finger count
 * required by Split game rules for that hand slot.
 */
export function validatePlayerHandCount(
  hand: Pick<DetectedHandSummary, "slot" | "fingerCount">,
  playerCounts: [number, number],
): HandValidationResult {
  const handIndex: 0 | 1 = hand.slot === "Left" ? 0 : 1;
  const expectedCount = playerCounts[handIndex];
  const label = handIndex === 0 ? "Left" : "Right";

  if (expectedCount === 0) {
    return {
      status: "eliminated",
      handIndex,
      expectedCount: 0,
      detectedCount: hand.fingerCount,
      message: `Your ${label} hand is OUT (0 fingers)`,
    };
  }

  if (hand.fingerCount !== expectedCount) {
    return {
      status: "mismatch",
      handIndex,
      expectedCount,
      detectedCount: hand.fingerCount,
      message: `Show ${expectedCount} finger${expectedCount === 1 ? "" : "s"} on your ${label} hand (detected ${hand.fingerCount})`,
    };
  }

  return {
    status: "matched",
    handIndex,
    expectedCount,
    detectedCount: hand.fingerCount,
    message: `Your ${label} hand (${expectedCount}) is ready — reach up to tap!`,
  };
}

const SPLIT_JOIN_LANDMARKS = [0, 4, 8, 9, 12, 17, 20] as const;

/**
 * Checks if player's Left & Right hands are brought close together / joined
 * to trigger a legal Split (2-0 -> 1-1 or 4-0 -> 2-2).
 */
export function areHandsTouchingForSplit(
  hands: DetectedHandSummary[],
  game: SplitState,
  videoWidth: number,
  videoHeight: number,
  viewWidth: number,
  viewHeight: number,
): boolean {
  if (game.turn !== "Player" || game.winner || !canSplitHands(game.player)) {
    return false;
  }
  const left = hands.find((h) => h.slot === "Left");
  const right = hands.find((h) => h.slot === "Right");
  if (!left || !right || left.landmarks.length < 21 || right.landmarks.length < 21) {
    return false;
  }

  const ptsL = SPLIT_JOIN_LANDMARKS.map((idx) => {
    const lm = left.landmarks[idx];
    return mapVideoNormToViewport(lm.x, lm.y, videoWidth, videoHeight, viewWidth, viewHeight, "cover");
  });
  const ptsR = SPLIT_JOIN_LANDMARKS.map((idx) => {
    const lm = right.landmarks[idx];
    return mapVideoNormToViewport(lm.x, lm.y, videoWidth, videoHeight, viewWidth, viewHeight, "cover");
  });

  const thresholdPx = Math.max(85, Math.min(viewWidth, viewHeight) * 0.16);
  const thresholdSq = thresholdPx * thresholdPx;

  for (const a of ptsL) {
    for (const b of ptsR) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy <= thresholdSq) {
        return true;
      }
    }
  }
  return false;
}

interface HandWaveTrack {
  anchorX: number;
  direction: -1 | 0 | 1;
  reversalsMs: number[];
  firstMotionMs: number;
  lastSeenMs: number;
}

export interface WaveRestartUpdate {
  progress: number;
  triggered: boolean;
  wavingBoth: boolean;
}

const WAVE_WINDOW_MS = 2200;
const MIN_SWING_DX = 0.028;
const REVERSALS_NEEDED_PER_HAND = 2;
const MIN_SUSTAINED_MS = 420;
const MISSING_GRACE_MS = 400;
const COOLDOWN_MS = 2200;

function sampleWaveX(hand: DetectedHandSummary): number {
  if (hand.landmarks.length >= 13) {
    return (hand.landmarks[9].x + hand.landmarks[12].x) * 0.5;
  }
  return hand.wristX;
}

/**
 * Requires BOTH hands visible and waving side-to-side continuously
 * before triggering a match reset, tolerating brief motion-blur frame drops.
 */
export class WaveRestartDetector {
  private tracks: Record<"Left" | "Right", HandWaveTrack | null> = {
    Left: null,
    Right: null,
  };
  private cooldownUntilMs = 0;

  reset(): void {
    this.tracks.Left = null;
    this.tracks.Right = null;
  }

  update(hands: DetectedHandSummary[], nowMs: number): WaveRestartUpdate {
    if (nowMs < this.cooldownUntilMs) {
      return { progress: 0, triggered: false, wavingBoth: false };
    }

    const left = hands.find((h) => h.slot === "Left");
    const right = hands.find((h) => h.slot === "Right");

    if (left) {
      this.advanceTrack("Left", sampleWaveX(left), nowMs);
    } else if (this.tracks.Left && nowMs - this.tracks.Left.lastSeenMs > MISSING_GRACE_MS) {
      this.tracks.Left = null;
    }

    if (right) {
      this.advanceTrack("Right", sampleWaveX(right), nowMs);
    } else if (this.tracks.Right && nowMs - this.tracks.Right.lastSeenMs > MISSING_GRACE_MS) {
      this.tracks.Right = null;
    }

    const trackL = this.tracks.Left;
    const trackR = this.tracks.Right;
    if (!trackL || !trackR) {
      return { progress: 0, triggered: false, wavingBoth: false };
    }

    const cutoff = nowMs - WAVE_WINDOW_MS;
    trackL.reversalsMs = trackL.reversalsMs.filter((t) => t >= cutoff);
    trackR.reversalsMs = trackR.reversalsMs.filter((t) => t >= cutoff);

    const leftCount = trackL.reversalsMs.length;
    const rightCount = trackR.reversalsMs.length;

    const reversalProgress = Math.min(
      1,
      Math.min(leftCount, rightCount) / REVERSALS_NEEDED_PER_HAND,
    );
    const sustainedMs = Math.min(nowMs - trackL.firstMotionMs, nowMs - trackR.firstMotionMs);
    const timeProgress = Math.min(1, sustainedMs / MIN_SUSTAINED_MS);
    const progress = leftCount >= 1 && rightCount >= 1 ? Math.min(reversalProgress, timeProgress) : 0;
    const wavingBoth = leftCount >= 1 && rightCount >= 1;

    if (
      leftCount >= REVERSALS_NEEDED_PER_HAND &&
      rightCount >= REVERSALS_NEEDED_PER_HAND &&
      sustainedMs >= MIN_SUSTAINED_MS
    ) {
      this.reset();
      this.cooldownUntilMs = nowMs + COOLDOWN_MS;
      return { progress: 1, triggered: true, wavingBoth: true };
    }

    return { progress, triggered: false, wavingBoth };
  }

  private advanceTrack(slot: "Left" | "Right", posX: number, nowMs: number): void {
    let track = this.tracks[slot];
    if (!track) {
      this.tracks[slot] = {
        anchorX: posX,
        direction: 0,
        reversalsMs: [],
        firstMotionMs: nowMs,
        lastSeenMs: nowMs,
      };
      return;
    }

    track.lastSeenMs = nowMs;
    const cutoff = nowMs - WAVE_WINDOW_MS;
    track.reversalsMs = track.reversalsMs.filter((t) => t >= cutoff);

    const delta = posX - track.anchorX;
    if (Math.abs(delta) >= MIN_SWING_DX) {
      const nextDir: -1 | 1 = delta > 0 ? 1 : -1;
      if (track.direction === 0) {
        track.firstMotionMs = nowMs;
      } else if (nextDir !== track.direction) {
        if (track.reversalsMs.length === 0) {
          track.firstMotionMs = Math.min(track.firstMotionMs, nowMs - 140);
        }
        track.reversalsMs.push(nowMs);
      }
      track.direction = nextDir;
      track.anchorX = posX;
    }
  }
}
