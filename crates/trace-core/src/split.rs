use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SplitPlayer {
    Player,
    Ai,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SplitAction {
    Attack { from: usize, to: usize },
    Split,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SplitState {
    pub player: [u8; 2],
    pub ai: [u8; 2],
    pub turn: SplitPlayer,
    pub winner: Option<SplitPlayer>,
}

impl Default for SplitState {
    fn default() -> Self {
        Self::new()
    }
}

impl SplitState {
    pub const fn new() -> Self {
        Self {
            player: [1, 1],
            ai: [1, 1],
            turn: SplitPlayer::Player,
            winner: None,
        }
    }

    pub fn can_split_hands(hands: [u8; 2]) -> bool {
        (hands[0] == 0 && (hands[1] == 2 || hands[1] == 4))
            || (hands[1] == 0 && (hands[0] == 2 || hands[0] == 4))
    }

    pub fn active_hands(&self, who: SplitPlayer) -> [u8; 2] {
        match who {
            SplitPlayer::Player => self.player,
            SplitPlayer::Ai => self.ai,
        }
    }

    pub fn legal_actions(&self) -> Vec<SplitAction> {
        if self.winner.is_some() {
            return Vec::new();
        }
        let (mine, opp) = match self.turn {
            SplitPlayer::Player => (self.player, self.ai),
            SplitPlayer::Ai => (self.ai, self.player),
        };

        let mut actions = Vec::new();
        for (from, &atk) in mine.iter().enumerate() {
            if atk == 0 {
                continue;
            }
            for (to, &def) in opp.iter().enumerate() {
                if def > 0 {
                    actions.push(SplitAction::Attack { from, to });
                }
            }
        }
        if Self::can_split_hands(mine) {
            actions.push(SplitAction::Split);
        }
        actions
    }

    pub fn apply(&self, action: SplitAction) -> Result<Self, String> {
        if self.winner.is_some() {
            return Err("Game has already ended".to_string());
        }

        let mut next = self.clone();
        let is_player_turn = self.turn == SplitPlayer::Player;

        match action {
            SplitAction::Attack { from, to } => {
                if from > 1 || to > 1 {
                    return Err("Hand index out of bounds".to_string());
                }
                let (mine, opp) = if is_player_turn {
                    (&next.player, &mut next.ai)
                } else {
                    (&next.ai, &mut next.player)
                };

                let atk = mine[from];
                let def = opp[to];
                if atk == 0 || def == 0 {
                    return Err("Both attacking and target hands must be active".to_string());
                }

                let sum = def + atk;
                opp[to] = if sum == 5 {
                    0
                } else if sum > 5 {
                    sum - 5
                } else {
                    sum
                };
            }
            SplitAction::Split => {
                let mine = if is_player_turn {
                    &mut next.player
                } else {
                    &mut next.ai
                };
                if !Self::can_split_hands(*mine) {
                    return Err(
                        "Can only split when one hand is out (0) and the other has 2 or 4 fingers"
                            .to_string(),
                    );
                }
                let total = mine[0] + mine[1];
                let half = total / 2;
                *mine = [half, half];
            }
        }

        if next.ai == [0, 0] {
            next.winner = Some(SplitPlayer::Player);
        } else if next.player == [0, 0] {
            next.winner = Some(SplitPlayer::Ai);
        } else {
            next.turn = if is_player_turn {
                SplitPlayer::Ai
            } else {
                SplitPlayer::Player
            };
        }

        Ok(next)
    }
}

fn evaluate_heuristic(state: &SplitState) -> i32 {
    match state.winner {
        Some(SplitPlayer::Ai) => return 10_000,
        Some(SplitPlayer::Player) => return -10_000,
        None => {}
    }

    let ai_alive = state.ai.iter().filter(|&&v| v > 0).count() as i32;
    let pl_alive = state.player.iter().filter(|&&v| v > 0).count() as i32;
    let ai_danger = state.ai.iter().filter(|&&v| v == 4).count() as i32;
    let pl_danger = state.player.iter().filter(|&&v| v == 4).count() as i32;

    // Having 2 active hands is much safer and stronger than 1; pushing opponent down to 1 hand or 4 is advantageous
    (ai_alive - pl_alive) * 120 + (pl_danger - ai_danger) * 15
}

fn minimax(
    state: &SplitState,
    depth: u8,
    mut alpha: i32,
    mut beta: i32,
    maximizing_ai: bool,
) -> i32 {
    if state.winner.is_some() || depth == 0 {
        let score = evaluate_heuristic(state);
        return if state.winner == Some(SplitPlayer::Ai) {
            score + i32::from(depth) * 10
        } else if state.winner == Some(SplitPlayer::Player) {
            score - i32::from(depth) * 10
        } else {
            score
        };
    }

    let actions = state.legal_actions();
    if maximizing_ai {
        let mut best = i32::MIN + 1;
        for act in actions {
            if let Ok(child) = state.apply(act) {
                let val = minimax(&child, depth - 1, alpha, beta, false);
                if val > best {
                    best = val;
                }
                if best > alpha {
                    alpha = best;
                }
                if beta <= alpha {
                    break;
                }
            }
        }
        best
    } else {
        let mut best = i32::MAX - 1;
        for act in actions {
            if let Ok(child) = state.apply(act) {
                let val = minimax(&child, depth - 1, alpha, beta, true);
                if val < best {
                    best = val;
                }
                if best < beta {
                    beta = best;
                }
                if beta <= alpha {
                    break;
                }
            }
        }
        best
    }
}

/// Computes the strongest strategic move for the AI using depth-6 alpha-beta search.
pub fn best_ai_move(state: &SplitState) -> Option<SplitAction> {
    if state.turn != SplitPlayer::Ai || state.winner.is_some() {
        return None;
    }

    let actions = state.legal_actions();
    if actions.is_empty() {
        return None;
    }

    // Immediate winning attack shortcut
    for &act in &actions {
        if let Ok(child) = state.apply(act) {
            if child.winner == Some(SplitPlayer::Ai) {
                return Some(act);
            }
        }
    }

    let mut best_act = actions[0];
    let mut best_score = i32::MIN + 1;

    for act in actions {
        if let Ok(child) = state.apply(act) {
            let score = minimax(&child, 5, i32::MIN + 1, i32::MAX - 1, false);
            if score > best_score {
                best_score = score;
                best_act = act;
            }
        }
    }

    Some(best_act)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_attack_exact_five_and_rollover() {
        let mut st = SplitState::new();
        assert_eq!(st.player, [1, 1]);
        assert_eq!(st.ai, [1, 1]);

        // Player 1 attacks AI 0: 1 + 1 = 2
        st = st.apply(SplitAction::Attack { from: 0, to: 0 }).unwrap();
        assert_eq!(st.ai, [2, 1]);
        assert_eq!(st.turn, SplitPlayer::Ai);

        // AI 0 (with 2) attacks Player 0 (with 1): 1 + 2 = 3
        st = st.apply(SplitAction::Attack { from: 0, to: 0 }).unwrap();
        assert_eq!(st.player, [3, 1]);

        // Player 0 (with 3) attacks AI 0 (with 2): 2 + 3 = 5 -> Exact 5 Eliminated (0)!
        st = st.apply(SplitAction::Attack { from: 0, to: 0 }).unwrap();
        assert_eq!(st.ai, [0, 1]);

        // Rollover test: 4 + 3 = 7 -> 2
        let roll_state = SplitState {
            player: [4, 1],
            ai: [3, 2],
            turn: SplitPlayer::Player,
            winner: None,
        };
        let after = roll_state
            .apply(SplitAction::Attack { from: 0, to: 0 })
            .unwrap();
        assert_eq!(after.ai[0], 2);
    }

    #[test]
    fn split_revive_rules_only_even_when_other_is_zero() {
        let s_2_0 = SplitState {
            player: [2, 0],
            ai: [1, 1],
            turn: SplitPlayer::Player,
            winner: None,
        };
        let after_2 = s_2_0.apply(SplitAction::Split).unwrap();
        assert_eq!(after_2.player, [1, 1]);

        let s_0_4 = SplitState {
            player: [0, 4],
            ai: [2, 1],
            turn: SplitPlayer::Player,
            winner: None,
        };
        let after_4 = s_0_4.apply(SplitAction::Split).unwrap();
        assert_eq!(after_4.player, [2, 2]);

        // Odd active hand (3-0) or both active (2-2) cannot split
        let s_3_0 = SplitState {
            player: [3, 0],
            ai: [1, 1],
            turn: SplitPlayer::Player,
            winner: None,
        };
        assert!(s_3_0.apply(SplitAction::Split).is_err());

        let s_2_2 = SplitState {
            player: [2, 2],
            ai: [1, 1],
            turn: SplitPlayer::Player,
            winner: None,
        };
        assert!(s_2_2.apply(SplitAction::Split).is_err());
    }

    #[test]
    fn split_win_and_ai_takes_winning_hit() {
        let state = SplitState {
            player: [0, 2],
            ai: [3, 1],
            turn: SplitPlayer::Ai,
            winner: None,
        };
        let mv = best_ai_move(&state).unwrap();
        assert_eq!(mv, SplitAction::Attack { from: 0, to: 1 });
        let ended = state.apply(mv).unwrap();
        assert_eq!(ended.winner, Some(SplitPlayer::Ai));
        assert_eq!(ended.player, [0, 0]);
    }
}

