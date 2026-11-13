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

export interface PlayerReadiness {
  canTap: boolean;
  status:
    | "ready"
    | "need_both_hands"
    | "need_active_hand"
    | "left_mismatch"
    | "right_mismatch"
    | "both_mismatch";
  message: string;
  leftHand: DetectedHandSummary | null;
  rightHand: DetectedHandSummary | null;
  leftMatches: boolean;
  rightMatches: boolean;
  aliveCount: number;
}

/**
 * Validates whether the player meets all Split game visibility and count requirements:
 * 1. If both hands are alive, BOTH hands must be visible in view and show their exact finger counts.
 * 2. If one hand is OUT (0 fingers), the player may keep it offscreen; only the active hand must be visible and match.
 * 3. Tapping is strictly blocked unless all active hand conditions are fully satisfied.
 */
export function checkPlayerReadiness(
  hands: DetectedHandSummary[],
  playerCounts: [number, number],
): PlayerReadiness {
  const leftAlive = playerCounts[0] > 0;
  const rightAlive = playerCounts[1] > 0;
  const aliveCount = (leftAlive ? 1 : 0) + (rightAlive ? 1 : 0);

  if (aliveCount === 0) {
    return {
      canTap: false,
      status: "need_active_hand",
      message: "No active hands remaining (Game Over)",
      leftHand: null,
      rightHand: null,
      leftMatches: false,
      rightMatches: false,
      aliveCount: 0,
    };
  }

  // Resolve leftHand and rightHand from detected camera hands
  let leftHand: DetectedHandSummary | null = null;
  let rightHand: DetectedHandSummary | null = null;

  if (hands.length === 1) {
    const single = hands[0];
    if (leftAlive && !rightAlive) {
      // Only Left hand is alive in game: single visible hand is the active Left hand
      leftHand = single;
    } else if (!leftAlive && rightAlive) {
      // Only Right hand is alive in game: single visible hand is the active Right hand
      rightHand = single;
    } else {
      // Both hands are alive in game, but player only holds up 1 hand
      if (single.slot === "Right" || single.wristX > 0.55) {
        rightHand = single;
      } else {
        leftHand = single;
      }
    }
  } else if (hands.length >= 2) {
    const bySlotLeft = hands.find((h) => h.slot === "Left");
    const bySlotRight = hands.find((h) => h.slot === "Right");

    if (bySlotLeft && bySlotRight && bySlotLeft !== bySlotRight) {
      leftHand = bySlotLeft;
      rightHand = bySlotRight;
    } else {
      // Mirrored horizontal order: lower wristX is left of screen, higher wristX is right of screen
      const sorted = [...hands].sort((a, b) => a.wristX - b.wristX);
      leftHand = sorted[0];
      rightHand = sorted[sorted.length - 1];
    }
  }

  const leftMatches = leftHand !== null && leftHand.fingerCount === playerCounts[0];
  const rightMatches = rightHand !== null && rightHand.fingerCount === playerCounts[1];

  // Case 1: Both hands alive in game -> BOTH hands must be on screen and show correct counts
  if (aliveCount === 2) {
    if (!leftHand || !rightHand) {
      const missing = !leftHand && !rightHand ? "both hands" : !leftHand ? "Left hand" : "Right hand";
      return {
        canTap: false,
        status: "need_both_hands",
        message: `Both hands must be visible! Raise your ${missing} (Left: ${playerCounts[0]}, Right: ${playerCounts[1]})`,
        leftHand,
        rightHand,
        leftMatches,
        rightMatches,
        aliveCount,
      };
    }

    if (!leftMatches && !rightMatches) {
      return {
        canTap: false,
        status: "both_mismatch",
        message: `Count mismatch! Show ${playerCounts[0]} on Left (saw ${leftHand.fingerCount}) & ${playerCounts[1]} on Right (saw ${rightHand.fingerCount})`,
        leftHand,
        rightHand,
        leftMatches: false,
        rightMatches: false,
        aliveCount,
      };
    }

    if (!leftMatches) {
      return {
        canTap: false,
        status: "left_mismatch",
        message: `Left hand mismatch! Show ${playerCounts[0]} finger${playerCounts[0] === 1 ? "" : "s"} on Left (saw ${leftHand.fingerCount})`,
        leftHand,
        rightHand,
        leftMatches: false,
        rightMatches: true,
        aliveCount,
      };
    }

    if (!rightMatches) {
      return {
        canTap: false,
        status: "right_mismatch",
        message: `Right hand mismatch! Show ${playerCounts[1]} finger${playerCounts[1] === 1 ? "" : "s"} on Right (saw ${rightHand.fingerCount})`,
        leftHand,
        rightHand,
        leftMatches: true,
        rightMatches: false,
        aliveCount,
      };
    }

    return {
      canTap: true,
      status: "ready",
      message: `Both hands ready (${playerCounts[0]} & ${playerCounts[1]})! Reach up to tap an AI hand`,
      leftHand,
      rightHand,
      leftMatches: true,
      rightMatches: true,
      aliveCount,
    };
  }

  // Case 2: Only Left hand is alive (Right is OUT) -> Right hand may be off-screen
  if (leftAlive) {
    if (!leftHand) {
      return {
        canTap: false,
        status: "need_active_hand",
        message: `Raise your active Left hand into view (${playerCounts[0]} finger${playerCounts[0] === 1 ? "" : "s"})`,
        leftHand: null,
        rightHand,
        leftMatches: false,
        rightMatches: false,
        aliveCount,
      };
    }
    if (!leftMatches) {
      return {
        canTap: false,
        status: "left_mismatch",
        message: `Left hand mismatch! Show ${playerCounts[0]} finger${playerCounts[0] === 1 ? "" : "s"} (saw ${leftHand.fingerCount})`,
        leftHand,
        rightHand,
        leftMatches: false,
        rightMatches: false,
        aliveCount,
      };
    }
    return {
      canTap: true,
      status: "ready",
      message: `Left hand ready (${playerCounts[0]})! Reach up to tap an AI hand`,
      leftHand,
      rightHand,
      leftMatches: true,
      rightMatches: false,
      aliveCount,
    };
  }

  // Case 3: Only Right hand is alive (Left is OUT) -> Left hand may be off-screen
  if (!rightHand) {
    return {
      canTap: false,
      status: "need_active_hand",
      message: `Raise your active Right hand into view (${playerCounts[1]} finger${playerCounts[1] === 1 ? "" : "s"})`,
      leftHand,
      rightHand: null,
      leftMatches: false,
      rightMatches: false,
      aliveCount,
    };
  }
  if (!rightMatches) {
    return {
      canTap: false,
      status: "right_mismatch",
      message: `Right hand mismatch! Show ${playerCounts[1]} finger${playerCounts[1] === 1 ? "" : "s"} (saw ${rightHand.fingerCount})`,
      leftHand,
      rightHand,
      leftMatches: false,
      rightMatches: false,
      aliveCount,
    };
  }
  return {
    canTap: true,
    status: "ready",
    message: `Right hand ready (${playerCounts[1]})! Reach up to tap an AI hand`,
    leftHand,
    rightHand,
    leftMatches: false,
    rightMatches: true,
    aliveCount,
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
  if (!hands || hands.length === 0) {
    return false;
  }

  // Find two candidate hands to compare
  let handA = hands.find((h) => h.slot === "Left");
  let handB = hands.find((h) => h.slot === "Right");

  if (!handA || !handB) {
    if (hands.length >= 2) {
      handA = hands[0];
      handB = hands[1];
    } else {
      return false;
    }
  }

  if (handA.landmarks.length < 21 || handB.landmarks.length < 21) {
    return false;
  }

  const ptsA = SPLIT_JOIN_LANDMARKS.map((idx) => {
    const lm = handA.landmarks[idx];
    return mapVideoNormToViewport(lm.x, lm.y, videoWidth, videoHeight, viewWidth, viewHeight, "cover");
  });
  const ptsB = SPLIT_JOIN_LANDMARKS.map((idx) => {
    const lm = handB.landmarks[idx];
    return mapVideoNormToViewport(lm.x, lm.y, videoWidth, videoHeight, viewWidth, viewHeight, "cover");
  });

  const thresholdPx = Math.max(110, Math.min(viewWidth, viewHeight) * 0.20);
  const thresholdSq = thresholdPx * thresholdPx;

  for (const a of ptsA) {
    for (const b of ptsB) {
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

const WAVE_WINDOW_MS = 2500;
const MIN_SWING_DX = 0.024;
const REVERSALS_NEEDED_PER_HAND = 2;
const MIN_SUSTAINED_MS = 280;
const MISSING_GRACE_MS = 900;
const COOLDOWN_MS = 2000;

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

    let left = hands.find((h) => h.slot === "Left");
    let right = hands.find((h) => h.slot === "Right");

    // If hands are detected but slot identities swapped or both defaulted to same slot,
    // disambiguate by screen x-coordinate so left side of screen is always Left track
    if (!left && !right && hands.length >= 2) {
      const sorted = [...hands].sort((a, b) => sampleWaveX(a) - sampleWaveX(b));
      left = sorted[0];
      right = sorted[1];
    } else if (hands.length === 2 && left && !right) {
      const other = hands.find((h) => h !== left);
      if (other) right = other;
    } else if (hands.length === 2 && right && !left) {
      const other = hands.find((h) => h !== right);
      if (other) left = other;
    }

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
