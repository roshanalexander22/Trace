import type { FingerStates } from "../platform/types";

export type HandCricketNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type HandCricketDifficulty = "easy" | "medium" | "hard";
export type TossParity = "Odd" | "Even";
export type CricketSide = "player" | "ai";
export type CricketRole = "Bat" | "Bowl";

export interface CricketBallRecord {
  innings: 1 | 2;
  ballNumber: number;
  battingSide: CricketSide;
  batsmanNum: HandCricketNumber;
  bowlerNum: HandCricketNumber;
  runsAdded: number;
  isOut: boolean;
}

export type HandCricketPhase =
  | "TOSS_CALL"
  | "TOSS_COUNTDOWN"
  | "TOSS_RESULT"
  | "TOSS_DECISION"
  | "PLAY_READY"
  | "BALL_COUNTDOWN"
  | "BALL_REVEAL"
  | "INNINGS_BREAK"
  | "MATCH_OVER";

export interface HandCricketMatchState {
  phase: HandCricketPhase;
  difficulty: HandCricketDifficulty;
  oversLimit: number | null;
  playerTossCall: TossParity | null;
  tossWinner: CricketSide | null;
  lastTossPlayerNum: HandCricketNumber | null;
  lastTossAiNum: HandCricketNumber | null;
  firstBattingSide: CricketSide | null;
  innings: 1 | 2;
  battingSide: CricketSide;
  innings1Runs: number;
  innings1Balls: number;
  innings1Out: boolean;
  innings2Runs: number;
  innings2Balls: number;
  innings2Out: boolean;
  target: number | null;
  winner: CricketSide | "tie" | null;
  playerHistory: HandCricketNumber[];
  ballLog: CricketBallRecord[];
  lastBall: CricketBallRecord | null;
}

export const ALL_CRICKET_NUMBERS: readonly HandCricketNumber[] = [0, 1, 2, 3, 4, 5, 6];

export const HAND_CRICKET_LABELS: Record<HandCricketNumber, string> = {
  0: "Dot (Closed Fist)",
  1: "Single (1 Finger)",
  2: "Double (2 Fingers)",
  3: "Triple (3 Fingers)",
  4: "Boundary 4 (4 Fingers)",
  5: "Five (Open Palm)",
  6: "Sixer (Thumbs Up)",
};

/**
 * Classifies MediaPipe/Rust 5-finger states into the official 0-6 Hand Cricket number.
 * Important: Thumb alone strictly maps to 6 (Thumbs Up), NEVER 1.
 */
export function classifyHandCricketNumber(fs: FingerStates): HandCricketNumber | null {
  const otherCount = [fs.index, fs.middle, fs.ring, fs.pinky].filter(Boolean).length;

  // Thumbs up -> 6
  if (fs.thumb && otherCount === 0) {
    return 6;
  }

  // Open palm (all 5 extended) -> 5
  if (fs.thumb && otherCount === 4) {
    return 5;
  }

  // 0 to 4 without thumb
  if (!fs.thumb) {
    return otherCount as 0 | 1 | 2 | 3 | 4;
  }

  // Partial thumb + 1..3 fingers is ambiguous (e.g. thumb sticking out on 1 finger)
  return null;
}

export function createInitialHandCricketState(
  difficulty: HandCricketDifficulty = "medium",
  oversLimit: number | null = null,
): HandCricketMatchState {
  return {
    phase: "TOSS_CALL",
    difficulty,
    oversLimit,
    playerTossCall: null,
    tossWinner: null,
    lastTossPlayerNum: null,
    lastTossAiNum: null,
    firstBattingSide: null,
    innings: 1,
    battingSide: "player",
    innings1Runs: 0,
    innings1Balls: 0,
    innings1Out: false,
    innings2Runs: 0,
    innings2Balls: 0,
    innings2Out: false,
    target: null,
    winner: null,
    playerHistory: [],
    ballLog: [],
    lastBall: null,
  };
}

export function formatOvers(balls: number): string {
  const completed = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${completed}.${rem}`;
}

export function computeTossWinner(
  playerCall: TossParity,
  playerNum: HandCricketNumber,
  aiNum: HandCricketNumber,
): { total: number; parity: TossParity; winner: CricketSide } {
  const total = playerNum + aiNum;
  const parity: TossParity = total % 2 === 0 ? "Even" : "Odd";
  return {
    total,
    parity,
    winner: parity === playerCall ? "player" : "ai",
  };
}

function weightedPick(weights: number[], rng: () => number): HandCricketNumber {
  const sum = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
  if (sum <= 0) {
    return ALL_CRICKET_NUMBERS[Math.floor(rng() * ALL_CRICKET_NUMBERS.length)];
  }
  let r = rng() * sum;
  for (let i = 0; i < ALL_CRICKET_NUMBERS.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return ALL_CRICKET_NUMBERS[i];
  }
  return ALL_CRICKET_NUMBERS[ALL_CRICKET_NUMBERS.length - 1];
}

/**
 * Selects the AI's number (0-6) STRICTLY BEFORE reading the player's current number.
 * - Easy: Uniform random 0-6
 * - Medium: Adapts from player's historical frequency distribution
 * - Hard: Markov sequence transition + recency-weighted behavioral prediction
 */
export function chooseAiHandCricketNumber(params: {
  difficulty: HandCricketDifficulty;
  aiRole: CricketRole;
  playerHistory: HandCricketNumber[];
  rng?: () => number;
}): HandCricketNumber {
  const { difficulty, aiRole, playerHistory } = params;
  const rng = params.rng ?? Math.random;

  if (difficulty === "easy" || playerHistory.length < 2) {
    return ALL_CRICKET_NUMBERS[Math.floor(rng() * ALL_CRICKET_NUMBERS.length)];
  }

  // Build frequency histogram
  const freq = new Array<number>(7).fill(0);
  for (const n of playerHistory) {
    freq[n] += 1;
  }

  if (difficulty === "medium") {
    if (aiRole === "Bowl") {
      // AI tries to match the player's preferred batting numbers
      const weights = freq.map((c) => 0.4 + c * 1.4);
      return weightedPick(weights, rng);
    }
    // AI Bats: avoid player's favorite bowling numbers and favor solid scoring shots
    const maxF = Math.max(...freq, 1);
    const runBias = [0.25, 0.8, 1.0, 1.25, 1.6, 1.5, 1.75];
    const weights = freq.map((c, n) => Math.max(0.15, (maxF - c + 0.6) * runBias[n]));
    return weightedPick(weights, rng);
  }

  // HARD: combine recency-weighted frequency + Markov first-order transitions
  const recencyFreq = new Array<number>(7).fill(0);
  const recentWindow = playerHistory.slice(-10);
  recentWindow.forEach((n, idx) => {
    recencyFreq[n] += 1 + idx * 0.25;
  });

  const transition = new Array<number>(7).fill(0);
  const lastMove = playerHistory[playerHistory.length - 1];
  for (let i = 0; i < playerHistory.length - 1; i++) {
    if (playerHistory[i] === lastMove) {
      transition[playerHistory[i + 1]] += 2.2;
    }
  }

  // Also slight repeat-aversion model: after throwing a 6 or 4 twice, humans switch
  const lastTwoSame =
    playerHistory.length >= 2 &&
    playerHistory[playerHistory.length - 1] === playerHistory[playerHistory.length - 2];

  const predictedScores = ALL_CRICKET_NUMBERS.map((n) => {
    let score = 0.2 + recencyFreq[n] * 0.8 + transition[n] * 1.6;
    if (lastTwoSame && n === lastMove) {
      score *= 0.45;
    }
    return score;
  });

  if (aiRole === "Bowl") {
    // Concentrate sharply on the top predicted player moves
    const sorted = [...predictedScores].sort((a, b) => b - a);
    const cutoff = sorted[2] ?? 0;
    const sharpWeights = predictedScores.map((s) => (s >= cutoff ? s * s : s * 0.15));
    return weightedPick(sharpWeights, rng);
  }

  // AI Bats on Hard: penalize the top-2 most likely player bowling numbers & target high runs
  const indexed = predictedScores.map((s, idx) => ({ idx, s })).sort((a, b) => b.s - a.s);
  const dangerSet = new Set([indexed[0].idx, indexed[1].idx]);
  const runValues = [0.2, 0.9, 1.2, 1.5, 2.0, 1.9, 2.3];
  const batWeights = ALL_CRICKET_NUMBERS.map((n) =>
    dangerSet.has(n) ? 0.08 : runValues[n] * (1 / (0.6 + predictedScores[n])),
  );
  return weightedPick(batWeights, rng);
}

/**
 * Resolves a single ball using official 0-6 Hand Cricket rules.
 */
export function resolveCricketBall(
  state: HandCricketMatchState,
  playerNum: HandCricketNumber,
  aiNum: HandCricketNumber,
): HandCricketMatchState {
  const batsmanNum = state.battingSide === "player" ? playerNum : aiNum;
  const bowlerNum = state.battingSide === "player" ? aiNum : playerNum;
  const isOut = batsmanNum === bowlerNum;
  const runsAdded = isOut ? 0 : batsmanNum;

  const prevBalls = state.innings === 1 ? state.innings1Balls : state.innings2Balls;
  const nextBalls = prevBalls + 1;

  const ballRecord: CricketBallRecord = {
    innings: state.innings,
    ballNumber: nextBalls,
    battingSide: state.battingSide,
    batsmanNum,
    bowlerNum,
    runsAdded,
    isOut,
  };

  const nextHistory = [...state.playerHistory, playerNum];
  const nextLog = [ballRecord, ...state.ballLog].slice(0, 60);

  if (state.innings === 1) {
    const nextRuns = state.innings1Runs + runsAdded;
    const hitOversLimit = state.oversLimit !== null && nextBalls >= state.oversLimit * 6;
    const inningsEnded = isOut || hitOversLimit;

    return {
      ...state,
      innings1Runs: nextRuns,
      innings1Balls: nextBalls,
      innings1Out: isOut,
      target: inningsEnded ? nextRuns + 1 : null,
      phase: inningsEnded ? "INNINGS_BREAK" : "BALL_REVEAL",
      playerHistory: nextHistory,
      ballLog: nextLog,
      lastBall: ballRecord,
    };
  }

  // Innings 2
  const nextRuns = state.innings2Runs + runsAdded;
  const targetReached = state.target !== null && nextRuns >= state.target;
  const hitOversLimit = state.oversLimit !== null && nextBalls >= state.oversLimit * 6;
  const inningsEnded = isOut || targetReached || hitOversLimit;

  let winner: CricketSide | "tie" | null = null;
  if (inningsEnded) {
    if (nextRuns > state.innings1Runs) {
      winner = state.battingSide;
    } else if (nextRuns < state.innings1Runs) {
      winner = state.battingSide === "player" ? "ai" : "player";
    } else {
      winner = "tie";
    }
  }

  return {
    ...state,
    innings2Runs: nextRuns,
    innings2Balls: nextBalls,
    innings2Out: isOut,
    winner,
    phase: inningsEnded ? "MATCH_OVER" : "BALL_REVEAL",
    playerHistory: nextHistory,
    ballLog: nextLog,
    lastBall: ballRecord,
  };
}

