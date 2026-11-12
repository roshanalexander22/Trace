import { describe, expect, it } from "vitest";
import { createInitialSplitState } from "./splitEngine";
import {
  WaveRestartDetector,
  areHandsTouchingForSplit,
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

