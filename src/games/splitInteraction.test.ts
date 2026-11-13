import { describe, expect, it } from "vitest";
import { createInitialSplitState } from "./splitEngine";
import {
  WaveRestartDetector,
  areHandsTouchingForSplit,
  checkPlayerReadiness,
  findTouchedAiTarget,
  validatePlayerHandCount,
} from "./splitInteraction";
import type { Point3 } from "../platform/types";
import type { DetectedHandSummary } from "../vision/visionBus";

function makeSummary(
  slot: "Left" | "Right",
  wristX: number,
  fingerCount = 1,
  landmarks: Point3[] = [],
): DetectedHandSummary {
  return {
    slot,
    handedness: slot,
    fingerCount,
    wristX,
    wristY: 0.75,
    stableGesture: "None",
    landmarks,
  };
}

function makeFlatHand(centerX: number, centerY = 0.65): Point3[] {
  return Array.from({ length: 21 }, (_, idx) => ({
    x: centerX + ((idx % 5) - 2) * 0.015,
    y: centerY + (idx > 8 ? -0.05 : 0.05),
    z: 0,
  }));
}

describe("splitInteraction", () => {
  it("registers tap only when contact points lie inside active AI hand target box", () => {
    const aiLeftBox = { left: 100, top: 20, right: 240, bottom: 160 };
    const aiRightBox = { left: 460, top: 20, right: 600, bottom: 160 };

    // Simply moving hand near top center (between the two AI hands) does NOT trigger a tap
    expect(
      findTouchedAiTarget([{ x: 350, y: 80 }], aiLeftBox, aiRightBox, [1, 1]),
    ).toBeNull();

    // Moving hand over AI Left box triggers target 0
    expect(
      findTouchedAiTarget([{ x: 170, y: 110 }], aiLeftBox, aiRightBox, [1, 1]),
    ).toBe(0);

    // Moving hand over an eliminated AI hand (0 fingers) does NOT trigger a tap
    expect(
      findTouchedAiTarget([{ x: 520, y: 100 }], aiLeftBox, aiRightBox, [2, 0]),
    ).toBeNull();
  });

  it("validates exact expected finger count before accepting a move", () => {
    const counts: [number, number] = [2, 0];

    const matched = validatePlayerHandCount(makeSummary("Left", 0.3, 2), counts);
    expect(matched.status).toBe("matched");

    const mismatch = validatePlayerHandCount(makeSummary("Left", 0.3, 1), counts);
    expect(mismatch.status).toBe("mismatch");
    expect(mismatch.expectedCount).toBe(2);
    expect(mismatch.detectedCount).toBe(1);

    const outHand = validatePlayerHandCount(makeSummary("Right", 0.7, 1), counts);
    expect(outHand.status).toBe("eliminated");
  });

  it("enforces that both hands are visible and counts match when both hands are alive", () => {
    const playerCounts: [number, number] = [1, 2];

    // Only 1 hand visible when both are alive -> tap is strictly BLOCKED
    const onlyOneHand = checkPlayerReadiness(
      [makeSummary("Left", 0.3, 1)],
      playerCounts,
    );
    expect(onlyOneHand.canTap).toBe(false);
    expect(onlyOneHand.status).toBe("need_both_hands");

    // Both hands visible, but left count is wrong (saw 2 instead of 1) -> tap is BLOCKED
    const leftMismatch = checkPlayerReadiness(
      [makeSummary("Left", 0.25, 2), makeSummary("Right", 0.75, 2)],
      playerCounts,
    );
    expect(leftMismatch.canTap).toBe(false);
    expect(leftMismatch.status).toBe("left_mismatch");

    // Both hands visible, but both counts wrong -> tap is BLOCKED
    const bothMismatch = checkPlayerReadiness(
      [makeSummary("Left", 0.25, 3), makeSummary("Right", 0.75, 1)],
      playerCounts,
    );
    expect(bothMismatch.canTap).toBe(false);
    expect(bothMismatch.status).toBe("both_mismatch");

    // Both hands visible and both counts match -> tap is ALLOWED
    const bothReady = checkPlayerReadiness(
      [makeSummary("Left", 0.25, 1), makeSummary("Right", 0.75, 2)],
      playerCounts,
    );
    expect(bothReady.canTap).toBe(true);
    expect(bothReady.status).toBe("ready");
  });

  it("permits eliminated hand to be off-screen when one hand is out", () => {
    // Left hand is 2, Right hand is 0 (eliminated)
    const leftActiveCounts: [number, number] = [2, 0];

    // Single active hand visible with 2 fingers -> tap is ALLOWED without right hand
    const leftReady = checkPlayerReadiness(
      [makeSummary("Left", 0.3, 2)],
      leftActiveCounts,
    );
    expect(leftReady.canTap).toBe(true);
    expect(leftReady.status).toBe("ready");

    // Single active hand visible with wrong count (1 finger) -> tap is BLOCKED
    const leftWrong = checkPlayerReadiness(
      [makeSummary("Left", 0.3, 1)],
      leftActiveCounts,
    );
    expect(leftWrong.canTap).toBe(false);
    expect(leftWrong.status).toBe("left_mismatch");

    // Right hand active (0, 3) with single right hand visible -> tap is ALLOWED
    const rightActiveCounts: [number, number] = [0, 3];
    const rightReady = checkPlayerReadiness(
      [makeSummary("Right", 0.7, 3)],
      rightActiveCounts,
    );
    expect(rightReady.canTap).toBe(true);
    expect(rightReady.status).toBe("ready");
  });

  it("requires both hands to wave laterally multiple times before triggering restart", () => {
    const detector = new WaveRestartDetector();

    // Only one hand waving does NOT progress toward reset
    for (let i = 0; i < 6; i++) {
      const res = detector.update(
        [makeSummary("Left", i % 2 === 0 ? 0.22 : 0.36)],
        100 + i * 160,
      );
      expect(res.triggered).toBe(false);
      expect(res.progress).toBe(0);
    }

    // Both hands stationary does NOT trigger reset
    const still = detector.update(
      [makeSummary("Left", 0.3), makeSummary("Right", 0.7)],
      1200,
    );
    expect(still.triggered).toBe(false);

    // Both hands waving back and forth (even with a brief single-frame drop) triggers reset
    const waveOffsets = [0.22, 0.35, 0.21, 0.36, 0.22];
    let triggered = false;
    waveOffsets.forEach((dx, idx) => {
      const hands =
        idx === 2
          ? [makeSummary("Left", dx)] // simulate brief single-frame motion-blur drop of Right hand
          : [makeSummary("Left", dx), makeSummary("Right", 0.4 + dx)];
      const res = detector.update(hands, 1500 + idx * 180);
      if (res.triggered) triggered = true;
    });
    expect(triggered).toBe(true);
  });

  it("detects joining both hands together for legal Split (2-0 or 4-0)", () => {
    const splitEligible = {
      ...createInitialSplitState(),
      player: [2, 0] as [number, number],
      turn: "Player" as const,
    };

    // Separated hands do not trigger split
    expect(
      areHandsTouchingForSplit(
        [
          makeSummary("Left", 0.25, 2, makeFlatHand(0.25)),
          makeSummary("Right", 0.75, 0, makeFlatHand(0.75)),
        ],
        splitEligible,
        640,
        480,
        960,
        640,
      ),
    ).toBe(false);

    // Joined hands (close boundary landmarks, even if fingers tilt during clap) trigger split
    expect(
      areHandsTouchingForSplit(
        [
          makeSummary("Left", 0.46, 1, makeFlatHand(0.46)),
          makeSummary("Right", 0.54, 0, makeFlatHand(0.54)),
        ],
        splitEligible,
        640,
        480,
        960,
        640,
      ),
    ).toBe(true);
  });

  it("sanity checks initial game state alignment", () => {
    const state = createInitialSplitState();
    expect(state.player).toEqual([1, 1]);
    expect(state.ai).toEqual([1, 1]);
  });
});

