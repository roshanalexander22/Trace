import { describe, expect, it } from "vitest";
import {
  chooseAiHandCricketNumber,
  classifyHandCricketNumber,
  computeTossWinner,
  createInitialHandCricketState,
  resolveCricketBall,
  type HandCricketMatchState,
} from "./handCricketEngine";

function states(
  thumb: boolean,
  index: boolean,
  middle: boolean,
  ring: boolean,
  pinky: boolean,
) {
  return {
    thumb,
    index,
    middle,
    ring,
    pinky,
    scores: [0, 0, 0, 0, 0] as [number, number, number, number, number],
  };
}

describe("handCricketEngine", () => {
  it("classifies 0-6 strictly where thumb alone maps to 6 (not 1)", () => {
    expect(classifyHandCricketNumber(states(false, false, false, false, false))).toBe(0);
    expect(classifyHandCricketNumber(states(false, true, false, false, false))).toBe(1);
    expect(classifyHandCricketNumber(states(false, true, true, false, false))).toBe(2);
    expect(classifyHandCricketNumber(states(false, true, true, true, false))).toBe(3);
    expect(classifyHandCricketNumber(states(false, true, true, true, true))).toBe(4);
    expect(classifyHandCricketNumber(states(true, true, true, true, true))).toBe(5);
    expect(classifyHandCricketNumber(states(true, false, false, false, false))).toBe(6);

    // Ambiguous thumb + 1 finger returns null
    expect(classifyHandCricketNumber(states(true, true, false, false, false))).toBeNull();
  });

  it("computes odd/even toss winner accurately", () => {
    const res = computeTossWinner("Odd", 3, 2);
    expect(res.total).toBe(5);
    expect(res.parity).toBe("Odd");
    expect(res.winner).toBe("player");

    const aiWin = computeTossWinner("Even", 3, 2);
    expect(aiWin.winner).toBe("ai");
  });

  it("scores runs, handles 0 vs 0 out, switches innings, and triggers early chase victory", () => {
    let match: HandCricketMatchState = {
      ...createInitialHandCricketState("easy", null),
      phase: "PLAY_READY",
      battingSide: "player",
      firstBattingSide: "player",
      innings: 1,
    };

    match = resolveCricketBall(match, 4, 2);
    expect(match.innings1Runs).toBe(4);
    expect(match.phase).toBe("BALL_REVEAL");

    match = resolveCricketBall(match, 6, 3);
    expect(match.innings1Runs).toBe(10);

    // Zero vs non-zero adds 0 runs without out
    match = resolveCricketBall(match, 0, 4);
    expect(match.innings1Runs).toBe(10);
    expect(match.innings1Out).toBe(false);

    // Matching 0 vs 0 puts batsman out and triggers innings break with target = 11
    match = resolveCricketBall(match, 0, 0);
    expect(match.innings1Out).toBe(true);
    expect(match.target).toBe(11);
    expect(match.phase).toBe("INNINGS_BREAK");

    // Innings 2: AI chases target 11
    match = {
      ...match,
      innings: 2,
      battingSide: "ai",
      phase: "PLAY_READY",
    };

    match = resolveCricketBall(match, 1, 6); // Player bowls 1, AI bats 6
    expect(match.innings2Runs).toBe(6);
    expect(match.winner).toBeNull();

    match = resolveCricketBall(match, 2, 5); // AI scores 5 -> total 11 >= target -> AI wins early
    expect(match.innings2Runs).toBe(11);
    expect(match.phase).toBe("MATCH_OVER");
    expect(match.winner).toBe("ai");
  });

  it("handles tied scores and AI difficulty strategy bias without cheating", () => {
    // Medium/Hard AI should exploit heavy bias toward 6 when bowling
    const rngZero = () => 0.12;
    const bowled = chooseAiHandCricketNumber({
      difficulty: "hard",
      aiRole: "Bowl",
      playerHistory: [6, 6, 4, 6, 4, 6, 4, 6],
      rng: rngZero,
    });
    expect(bowled).toBeGreaterThanOrEqual(0);
    expect(bowled).toBeLessThanOrEqual(6);

    // Medium AI bowling favors frequent number (4) over unused numbers when sampling middle weights
    let countFreqTarget = 0;
    for (let i = 0; i < 100; i++) {
      const pick = chooseAiHandCricketNumber({
        difficulty: "medium",
        aiRole: "Bowl",
        playerHistory: [4, 4, 4, 4, 4, 4, 4, 4],
        rng: () => i / 100,
      });
      if (pick === 4) countFreqTarget += 1;
    }
    expect(countFreqTarget).toBeGreaterThan(50);

    // Tie scenario
    let tieMatch: HandCricketMatchState = {
      ...createInitialHandCricketState("easy", null),
      innings: 2,
      battingSide: "player",
      innings1Runs: 6,
      target: 7,
      phase: "PLAY_READY",
    };
    tieMatch = resolveCricketBall(tieMatch, 6, 1); // Player reaches 6
    tieMatch = resolveCricketBall(tieMatch, 3, 3); // Player OUT on 6 -> Tie!
    expect(tieMatch.phase).toBe("MATCH_OVER");
    expect(tieMatch.winner).toBe("tie");
  });
});
