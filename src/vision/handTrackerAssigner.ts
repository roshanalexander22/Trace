export type HandSlot = "Left" | "Right";

export interface RawHandObservation {
  index: number;
  /** Mirrored normalized wrist X in [0..1] (0 = left side of displayed preview, 1 = right side). */
  wristX: number;
  wristY: number;
  handedness: "Left" | "Right" | "Unknown";
}

export interface SlotTrackState {
  wristX: number;
  wristY: number;
  vx: number;
  vy: number;
  lastSeenMs: number;
}

export interface HandTrackerMemory {
  Left: SlotTrackState | null;
  Right: SlotTrackState | null;
}

export interface AssignedHandSlot {
  slot: HandSlot;
  observationIndex: number;
}

const SLOT_EXPIRY_MS = 450;
const SINGLE_HAND_SWITCH_DIST_SQ = 0.34 * 0.34;
const VELOCITY_EXTRAPOLATION_MAX_S = 0.14;

export function createHandTrackerMemory(): HandTrackerMemory {
  return { Left: null, Right: null };
}

function predictedPos(track: SlotTrackState, nowMs: number): { x: number; y: number } {
  const dtS = Math.min(Math.max(0, (nowMs - track.lastSeenMs) / 1000), VELOCITY_EXTRAPOLATION_MAX_S);
  return {
    x: track.wristX + track.vx * dtS,
    y: track.wristY + track.vy * dtS,
  };
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function updateSlotState(
  prev: SlotTrackState | null,
  obs: RawHandObservation,
  nowMs: number,
): SlotTrackState {
  if (!prev || nowMs - prev.lastSeenMs > SLOT_EXPIRY_MS) {
    return {
      wristX: obs.wristX,
      wristY: obs.wristY,
      vx: 0,
      vy: 0,
      lastSeenMs: nowMs,
    };
  }
  const dtS = Math.max(0.008, (nowMs - prev.lastSeenMs) / 1000);
  const instVx = (obs.wristX - prev.wristX) / dtS;
  const instVy = (obs.wristY - prev.wristY) / dtS;
  // Blend velocity smoothly so temporary jitter does not overshoot crossing predictions
  const alpha = 0.45;
  return {
    wristX: obs.wristX,
    wristY: obs.wristY,
    vx: prev.vx * (1 - alpha) + instVx * alpha,
    vy: prev.vy * (1 - alpha) + instVy * alpha,
    lastSeenMs: nowMs,
  };
}

/**
 * Assigns incoming MediaPipe hand detections to persistent `"Left"` / `"Right"` slots.
 * Uses velocity-extrapolated wrist continuity so hands do not swap identities when crossing paths.
 */
export function assignHandSlots(
  observations: RawHandObservation[],
  memory: HandTrackerMemory,
  nowMs: number,
): AssignedHandSlot[] {
  const leftActive = memory.Left && nowMs - memory.Left.lastSeenMs <= SLOT_EXPIRY_MS ? memory.Left : null;
  const rightActive =
    memory.Right && nowMs - memory.Right.lastSeenMs <= SLOT_EXPIRY_MS ? memory.Right : null;

  if (!leftActive) memory.Left = null;
  if (!rightActive) memory.Right = null;

  if (observations.length === 0) {
    return [];
  }

  if (observations.length === 1) {
    const obs = observations[0];
    let chosenSlot: HandSlot | null = null;

    if (leftActive && rightActive) {
      const predL = predictedPos(leftActive, nowMs);
      const predR = predictedPos(rightActive, nowMs);
      const dL = distSq(obs.wristX, obs.wristY, predL.x, predL.y);
      const dR = distSq(obs.wristX, obs.wristY, predR.x, predR.y);
      chosenSlot = dL <= dR ? "Left" : "Right";
    } else if (leftActive) {
      const predL = predictedPos(leftActive, nowMs);
      if (distSq(obs.wristX, obs.wristY, predL.x, predL.y) <= SINGLE_HAND_SWITCH_DIST_SQ) {
        chosenSlot = "Left";
      }
    } else if (rightActive) {
      const predR = predictedPos(rightActive, nowMs);
      if (distSq(obs.wristX, obs.wristY, predR.x, predR.y) <= SINGLE_HAND_SWITCH_DIST_SQ) {
        chosenSlot = "Right";
      }
    }

    if (!chosenSlot) {
      chosenSlot = obs.wristX <= 0.5 ? "Left" : "Right";
    }

    memory[chosenSlot] = updateSlotState(memory[chosenSlot], obs, nowMs);
    return [{ slot: chosenSlot, observationIndex: obs.index }];
  }

  // Two or more observations: use the two detections (MediaPipe numHands=2)
  const [a, b] = observations;
  let assignA: HandSlot;
  let assignB: HandSlot;

  if (leftActive && rightActive) {
    const predL = predictedPos(leftActive, nowMs);
    const predR = predictedPos(rightActive, nowMs);

    const costAB =
      distSq(a.wristX, a.wristY, predL.x, predL.y) +
      distSq(b.wristX, b.wristY, predR.x, predR.y);
    const costBA =
      distSq(b.wristX, b.wristY, predL.x, predL.y) +
      distSq(a.wristX, a.wristY, predR.x, predR.y);

    if (costAB <= costBA) {
      assignA = "Left";
      assignB = "Right";
    } else {
      assignA = "Right";
      assignB = "Left";
    }
  } else if (leftActive || rightActive) {
    const activeSlot: HandSlot = leftActive ? "Left" : "Right";
    const otherSlot: HandSlot = activeSlot === "Left" ? "Right" : "Left";
    const activeTrack = (leftActive ?? rightActive)!;
    const pred = predictedPos(activeTrack, nowMs);
    const dA = distSq(a.wristX, a.wristY, pred.x, pred.y);
    const dB = distSq(b.wristX, b.wristY, pred.x, pred.y);

    if (dA <= dB) {
      assignA = activeSlot;
      assignB = otherSlot;
    } else {
      assignA = otherSlot;
      assignB = activeSlot;
    }
  } else {
    // Fresh dual-hand appearance: assign by mirrored screen horizontal order
    if (a.wristX <= b.wristX) {
      assignA = "Left";
      assignB = "Right";
    } else {
      assignA = "Right";
      assignB = "Left";
    }
  }

  memory[assignA] = updateSlotState(memory[assignA], a, nowMs);
  memory[assignB] = updateSlotState(memory[assignB], b, nowMs);

  const pairs: AssignedHandSlot[] = [
    { slot: assignA, observationIndex: a.index },
    { slot: assignB, observationIndex: b.index },
  ];
  pairs.sort((x, y) => (x.slot === y.slot ? 0 : x.slot === "Left" ? -1 : 1));
  return pairs;
}

