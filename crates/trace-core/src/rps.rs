use crate::types::{RoundOutcome, RpsMove};
use sha2::{Digest, Sha256};

/// Evaluates classic Rock-Paper-Scissors rules.
pub fn evaluate_round(player: RpsMove, ai: RpsMove) -> RoundOutcome {
    match (player, ai) {
        (a, b) if a == b => RoundOutcome::Draw,
        (RpsMove::Rock, RpsMove::Scissors)
        | (RpsMove::Paper, RpsMove::Rock)
        | (RpsMove::Scissors, RpsMove::Paper) => RoundOutcome::PlayerWin,
        _ => RoundOutcome::AiWin,
    }
}

/// Computes deterministic SHA-256 commit hash for fair-play verification:
/// `SHA256("<Move>:<salt_hex>")`.
pub fn compute_commitment(ai_move: RpsMove, salt_hex: &str) -> String {
    let move_str = match ai_move {
        RpsMove::Rock => "Rock",
        RpsMove::Paper => "Paper",
        RpsMove::Scissors => "Scissors",
    };
    let mut hasher = Sha256::new();
    hasher.update(format!("{move_str}:{salt_hex}").as_bytes());
    hex::encode(hasher.finalize())
}

/// Verifies a revealed AI move and salt against a previously published commitment hash.
pub fn verify_commitment(ai_move: RpsMove, salt_hex: &str, commitment_hex: &str) -> bool {
    compute_commitment(ai_move, salt_hex) == commitment_hex
}

