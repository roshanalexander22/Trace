import { describe, expect, it } from "vitest";
import {
  assignHandSlots,
  createHandTrackerMemory,
  type AssignedHandSlot,
} from "./handTrackerAssigner";

describe("handTrackerAssigner", () => {
  it("assigns fresh two hands by horizontal mirrored screen side (Left vs Right)", () => {
    const memory = createHandTrackerMemory();
    const assigned = assignHandSlots(
      [
        { index: 0, wristX: 0.72, wristY: 0.78, handedness: "Left" },
        { index: 1, wristX: 0.28, wristY: 0.78, handedness: "Right" },
      ],
      memory,
      100,
    );
    expect(assigned).toEqual([
      { slot: "Left", observationIndex: 1 },
      { slot: "Right", observationIndex: 0 },
    ]);
  });

  it("preserves Left and Right hand identities when both hands cross paths", () => {
    const memory = createHandTrackerMemory();
    // Initial: Left hand at x=0.25, Right hand at x=0.75
    assignHandSlots(
      [
        { index: 0, wristX: 0.25, wristY: 0.7, handedness: "Left" },
        { index: 1, wristX: 0.75, wristY: 0.7, handedness: "Right" },
      ],
      memory,
      100,
    );

    // Move smoothly toward center and cross each other even if MediaPipe swaps labels
    const steps = [
      { t: 150, lX: 0.38, rX: 0.62 },
      { t: 200, lX: 0.51, rX: 0.49 },
      { t: 250, lX: 0.65, rX: 0.35 },
    ];

    let lastResult: AssignedHandSlot[] = [];
    for (const step of steps) {
      lastResult = assignHandSlots(
        [
          { index: 0, wristX: step.rX, wristY: 0.68, handedness: "Left" },
          { index: 1, wristX: step.lX, wristY: 0.65, handedness: "Right" },
        ],
        memory,
        step.t,
      );
    }

    // Observation 1 (originally Left hand, now at x=0.65) stays in slot "Left"
    // Observation 0 (originally Right hand, now at x=0.35) stays in slot "Right"
    expect(lastResult).toEqual([
      { slot: "Left", observationIndex: 1 },
      { slot: "Right", observationIndex: 0 },
    ]);
  });

  it("retains identity when a single active hand reaches across midline to tap opponent", () => {
    const memory = createHandTrackerMemory();
    assignHandSlots([{ index: 0, wristX: 0.76, wristY: 0.75, handedness: "Right" }], memory, 100);
    // Hand moves diagonally toward top-left AI hand (x=0.32, y=0.25) smoothly
    const mid = assignHandSlots(
      [{ index: 0, wristX: 0.55, wristY: 0.52, handedness: "Right" }],
      memory,
      160,
    );
    const topLeft = assignHandSlots(
      [{ index: 0, wristX: 0.32, wristY: 0.25, handedness: "Left" }],
      memory,
      220,
    );
    expect(mid[0].slot).toBe("Right");
    expect(topLeft[0].slot).toBe("Right");
  });
});
