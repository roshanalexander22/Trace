use crate::types::{DrawingState, FingerStates, GestureKind};

/// Classifies raw finger extension states into high-level gestures.
/// Notice thumb flexibility on Rock, PointIndex, and Scissors to prevent false rejections
/// when a user rests their thumb naturally against or across the palm.
pub fn classify_raw_gesture(states: &FingerStates) -> GestureKind {
    match (states.thumb, states.index, states.middle, states.ring, states.pinky) {
        // Rock: all four main fingers folded (thumb may rest naturally on top or side)
        (_, false, false, false, false) => GestureKind::Rock,
        // Paper / Open Palm: all four fingers extended; thumb either spread or naturally open
        (true, true, true, true, true) => GestureKind::Paper,
        (false, true, true, true, true) if states.scores[0] > 0.32 => GestureKind::Paper,
        // Index Point (Draw mode): only index extended
        (_, true, false, false, false) => GestureKind::PointIndex,
        // Scissors / Peace Hover: index + middle extended, ring + pinky folded
        (_, true, true, false, false) => GestureKind::Scissors,
        _ => GestureKind::Unknown,
    }
}

/// Maps a classified gesture to Air Drawing state.
/// - `PointIndex` -> `Draw` (active ink)
/// - `Scissors` (PeaceHover) -> `Hover` (move cursor without drawing)
/// - `Paper` / `Rock` -> `Pause` (lift pen & finish stroke)
pub fn map_gesture_to_drawing_state(gesture: GestureKind) -> DrawingState {
    match gesture {
        GestureKind::PointIndex => DrawingState::Draw,
        GestureKind::Scissors | GestureKind::PeaceHover => DrawingState::Hover,
        GestureKind::Paper | GestureKind::Rock => DrawingState::Pause,
        GestureKind::None | GestureKind::Unknown => DrawingState::Idle,
    }
}

/// Temporal hysteresis stabilizer that eliminates single-frame transitional flicker
/// (e.g. a fist opening into an open palm briefly passing through Scissors).
#[derive(Debug, Clone)]
pub struct GestureStabilizer {
    candidate: GestureKind,
    candidate_streak: u8,
    stable: GestureKind,
}

impl Default for GestureStabilizer {
    fn default() -> Self {
        Self::new()
    }
}

impl GestureStabilizer {
    pub const fn new() -> Self {
        Self {
            candidate: GestureKind::None,
            candidate_streak: 0,
            stable: GestureKind::None,
        }
    }

    pub fn reset(&mut self) {
        self.candidate = GestureKind::None;
        self.candidate_streak = 0;
        self.stable = GestureKind::None;
    }

    pub fn update(&mut self, raw: GestureKind, required_frames: u8) -> GestureKind {
        let req = required_frames.max(1);
        if raw == self.candidate {
            self.candidate_streak = self.candidate_streak.saturating_add(1);
        } else {
            self.candidate = raw;
            self.candidate_streak = 1;
        }

        if self.candidate_streak >= req {
            self.stable = self.candidate;
        }
        self.stable
    }
}

