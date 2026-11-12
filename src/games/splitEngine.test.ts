import { describe, expect, it } from "vitest";
import {
  applySplitAction,
  canSplitHands,
  chooseBestAiSplitAction,
  createInitialSplitState,
  type SplitState,
} from "./splitEngine";

describe("splitEngine", () => {
  it("handles attacks, exact 5 elimination, and modulo-5 rollover", () => {
    let st = createInitialSplitState();
    expect(st.player).toEqual([1, 1]);
    expect(st.ai).toEqual([1, 1]);

    // Player left (1) taps AI left (1) -> 2
    st = applySplitAction(st, { type: "attack", from: 0, to: 0 });
    expect(st.ai).toEqual([2, 1]);

    // Rollover 4 + 3 = 7 -> 2
    const roll: SplitState = {
      player: [4, 2],
      ai: [3, 1],
      turn: "Player",
      winner: null,
    };
    const afterRoll = applySplitAction(roll, { type: "attack", from: 0, to: 0 });
    expect(afterRoll.ai[0]).toBe(2);

    // Exact 5 elimination: 2 + 3 = 5 -> 0
    const elim: SplitState = {
      player: [3, 1],
      ai: [2, 1],
      turn: "Player",
      winner: null,
    };
    const afterElim = applySplitAction(elim, { type: "attack", from: 0, to: 0 });
    expect(afterElim.ai[0]).toBe(0);
  });

  it("enforces split rules strictly for even totals when one hand is 0", () => {
    expect(canSplitHands([2, 0])).toBe(true);
    expect(canSplitHands([0, 4])).toBe(true);
    expect(canSplitHands([3, 0])).toBe(false);
    expect(canSplitHands([1, 0])).toBe(false);
    expect(canSplitHands([2, 2])).toBe(false);

    const revived = applySplitAction(
      { player: [0, 4], ai: [1, 2], turn: "Player", winner: null },
      { type: "split" },
    );
    expect(revived.player).toEqual([2, 2]);
  });

  it("detects win when both opponent hands hit 5 and AI takes winning move", () => {
    const state: SplitState = {
      player: [0, 3],
      ai: [2, 1],
      turn: "Ai",
      winner: null,
    };
    const aiMove = chooseBestAiSplitAction(state);
    expect(aiMove).toEqual({ type: "attack", from: 0, to: 1 });
    const ended = applySplitAction(state, aiMove!);
    expect(ended.winner).toBe("Ai");
    expect(ended.player).toEqual([0, 0]);
  });
});

