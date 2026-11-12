export type SplitPlayer = "Player" | "Ai";

export type SplitAction =
  | { type: "attack"; from: 0 | 1; to: 0 | 1 }
  | { type: "split" };

export interface SplitState {
  player: [number, number];
  ai: [number, number];
  turn: SplitPlayer;
  winner: SplitPlayer | null;
}

export function createInitialSplitState(): SplitState {
  return {
    player: [1, 1],
    ai: [1, 1],
    turn: "Player",
    winner: null,
  };
}

export function canSplitHands(hands: [number, number]): boolean {
  return (
    (hands[0] === 0 && (hands[1] === 2 || hands[1] === 4)) ||
    (hands[1] === 0 && (hands[0] === 2 || hands[0] === 4))
  );
}

export function getLegalSplitActions(state: SplitState): SplitAction[] {
  if (state.winner !== null) return [];
  const mine = state.turn === "Player" ? state.player : state.ai;
  const opp = state.turn === "Player" ? state.ai : state.player;
  const actions: SplitAction[] = [];

  for (const from of [0, 1] as const) {
    if (mine[from] <= 0) continue;
    for (const to of [0, 1] as const) {
      if (opp[to] > 0) {
        actions.push({ type: "attack", from, to });
      }
    }
  }
  if (canSplitHands(mine)) {
    actions.push({ type: "split" });
  }
  return actions;
}

export function applySplitAction(state: SplitState, action: SplitAction): SplitState {
  if (state.winner !== null) {
    throw new Error("Game has already ended");
  }

  const next: SplitState = {
    player: [state.player[0], state.player[1]],
    ai: [state.ai[0], state.ai[1]],
    turn: state.turn,
    winner: null,
  };

  const isPlayer = state.turn === "Player";
  const mine = isPlayer ? next.player : next.ai;
  const opp = isPlayer ? next.ai : next.player;

  if (action.type === "attack") {
    const atk = mine[action.from];
    const def = opp[action.to];
    if (atk <= 0 || def <= 0) {
      throw new Error("Both attacking and target hands must be active");
    }
    const sum = def + atk;
    opp[action.to] = sum === 5 ? 0 : sum > 5 ? sum - 5 : sum;
  } else {
    if (!canSplitHands(mine)) {
      throw new Error("Can only split when one hand is 0 and the active hand is 2 or 4");
    }
    const half = (mine[0] + mine[1]) / 2;
    mine[0] = half;
    mine[1] = half;
  }

  if (next.ai[0] === 0 && next.ai[1] === 0) {
    next.winner = "Player";
  } else if (next.player[0] === 0 && next.player[1] === 0) {
    next.winner = "Ai";
  } else {
    next.turn = isPlayer ? "Ai" : "Player";
  }

  return next;
}

function evaluateSplitHeuristic(state: SplitState): number {
  if (state.winner === "Ai") return 10_000;
  if (state.winner === "Player") return -10_000;

  const aiAlive = (state.ai[0] > 0 ? 1 : 0) + (state.ai[1] > 0 ? 1 : 0);
  const plAlive = (state.player[0] > 0 ? 1 : 0) + (state.player[1] > 0 ? 1 : 0);
  const aiDanger = (state.ai[0] === 4 ? 1 : 0) + (state.ai[1] === 4 ? 1 : 0);
  const plDanger = (state.player[0] === 4 ? 1 : 0) + (state.player[1] === 4 ? 1 : 0);

  return (aiAlive - plAlive) * 120 + (plDanger - aiDanger) * 15;
}

function minimax(
  state: SplitState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingAi: boolean,
): number {
  if (state.winner !== null || depth === 0) {
    const base = evaluateSplitHeuristic(state);
    if (state.winner === "Ai") return base + depth * 10;
    if (state.winner === "Player") return base - depth * 10;
    return base;
  }

  const actions = getLegalSplitActions(state);
  if (maximizingAi) {
    let best = -Infinity;
    for (const act of actions) {
      const val = minimax(applySplitAction(state, act), depth - 1, alpha, beta, false);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const act of actions) {
      const val = minimax(applySplitAction(state, act), depth - 1, alpha, beta, true);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function chooseBestAiSplitAction(state: SplitState): SplitAction | null {
  if (state.turn !== "Ai" || state.winner !== null) return null;
  const actions = getLegalSplitActions(state);
  if (actions.length === 0) return null;

  for (const act of actions) {
    if (applySplitAction(state, act).winner === "Ai") return act;
  }

  let bestAct = actions[0];
  let bestScore = -Infinity;
  for (const act of actions) {
    const score = minimax(applySplitAction(state, act), 5, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestAct = act;
    }
  }
  return bestAct;
}

