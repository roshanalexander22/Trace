import { create } from "zustand";
import type { RpsResultDto, ScoreboardSummaryDto } from "../platform/types";

export type GamePhase = "IDLE" | "COUNTDOWN" | "CAPTURE" | "REVEAL" | "NO_GESTURE_RETRY";

interface GameStoreState {
  phase: GamePhase;
  countdownValue: 3 | 2 | 1 | 0;
  autoNextRound: boolean;
  roundId: string | null;
  commitmentSha256: string | null;
  lastResult: RpsResultDto | null;
  scoreboard: ScoreboardSummaryDto;

  setPhase: (phase: GamePhase) => void;
  setCountdownValue: (val: 3 | 2 | 1 | 0) => void;
  setAutoNextRound: (auto: boolean) => void;
  setCommitment: (roundId: string | null, commitmentSha256: string | null) => void;
  setLastResult: (res: RpsResultDto | null) => void;
  setScoreboard: (sb: ScoreboardSummaryDto) => void;
}

export const EMPTY_SCOREBOARD: ScoreboardSummaryDto = {
  player_wins: 0,
  ai_wins: 0,
  draws: 0,
  total_rounds: 0,
  current_streak: 0,
  win_rate: 0,
  recent_matches: [],
};

export const useGameStore = create<GameStoreState>((set) => ({
  phase: "IDLE",
  countdownValue: 3,
  autoNextRound: false,
  roundId: null,
  commitmentSha256: null,
  lastResult: null,
  scoreboard: EMPTY_SCOREBOARD,

  setPhase: (phase) => set({ phase }),
  setCountdownValue: (countdownValue) => set({ countdownValue }),
  setAutoNextRound: (autoNextRound) => set({ autoNextRound }),
  setCommitment: (roundId, commitmentSha256) => set({ roundId, commitmentSha256 }),
  setLastResult: (lastResult) => set({ lastResult }),
  setScoreboard: (scoreboard) => set({ scoreboard }),
}));

