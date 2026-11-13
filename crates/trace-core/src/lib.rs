pub mod classifier;
pub mod drawing;
pub mod geometry;
pub mod rps;
pub mod smoothing;
pub mod split;
pub mod types;

use classifier::{classify_raw_gesture, map_gesture_to_drawing_state, GestureStabilizer};
use geometry::{evaluate_finger_states, parse_landmarks};
use smoothing::HandSmoother;
use types::{
    CalibrationProfile, DrawingState, FingerStates, GestureKind, Handedness, ProcessedHandFrame,
    StrokePoint,
};

/// Stateful high-frequency vision processing pipeline executed per camera frame.
/// Designed to run with zero heap churn inside `trace-wasm` or native Rust tests.
#[derive(Debug, Clone)]
pub struct VisionPipeline {
    profile: CalibrationProfile,
    smoother: HandSmoother,
    stabilizer: GestureStabilizer,
    low_confidence_streak: u16,
}

impl Default for VisionPipeline {
    fn default() -> Self {
        Self::new(CalibrationProfile::default())
    }
}

impl VisionPipeline {
    pub fn new(profile: CalibrationProfile) -> Self {
        Self {
            profile,
            smoother: HandSmoother::new(),
            stabilizer: GestureStabilizer::new(),
            low_confidence_streak: 0,
        }
    }

    pub fn update_calibration(&mut self, profile: CalibrationProfile) {
        self.profile = profile;
    }

    pub fn calibration(&self) -> &CalibrationProfile {
        &self.profile
    }

    pub fn reset(&mut self) {
        self.smoother.reset();
        self.stabilizer.reset();
        self.low_confidence_streak = 0;
    }

    /// Processes a single MediaPipe hand detection frame.
    /// - `screen_flat`: 63 floats `[x0, y0, z0, ...]` in normalized `[0..1]` image space.
    /// - `world_flat`: optional 63 floats in metric 3D space (used for accurate joint angles when available).
    pub fn process_frame(
        &mut self,
        screen_flat: &[f32],
        world_flat: Option<&[f32]>,
        handedness: Handedness,
        timestamp_ms: f64,
        confidence: f32,
    ) -> ProcessedHandFrame {
        let mirror = self.profile.mirror_feed;
        let Some(raw_screen) = parse_landmarks(screen_flat, mirror) else {
            self.reset();
            return self.empty_frame(confidence);
        };

        let smoothed_screen = self.smoother.smooth_landmarks(
            &raw_screen,
            timestamp_ms,
            self.profile.one_euro_min_cutoff,
            self.profile.one_euro_beta,
            self.profile.one_euro_d_cutoff,
        );

        let angle_source = world_flat
            .and_then(|w| parse_landmarks(w, mirror))
            .unwrap_or(raw_screen);

        let (finger_states, finger_angles_deg, valid_palm) =
            evaluate_finger_states(&angle_source, &self.profile);

        if !valid_palm {
            return self.empty_frame(confidence);
        }

        if confidence < 0.55 {
            self.low_confidence_streak = self.low_confidence_streak.saturating_add(1);
        } else {
            self.low_confidence_streak = 0;
        }

        let raw_gesture = classify_raw_gesture(&finger_states);
        let stable_gesture = self
            .stabilizer
            .update(raw_gesture, self.profile.stability_frames);
        let drawing_state = map_gesture_to_drawing_state(stable_gesture);

        let index_tip = smoothed_screen[8];
        let cursor = Some(StrokePoint {
            x: index_tip.x.clamp(0.0, 1.0),
            y: index_tip.y.clamp(0.0, 1.0),
        });

        ProcessedHandFrame {
            detected: true,
            handedness,
            landmarks: raw_screen.to_vec(),
            cursor,
            finger_states,
            raw_gesture,
            stable_gesture,
            drawing_state,
            confidence,
            low_light_warning: self.low_confidence_streak >= 10,
            finger_angles_deg,
        }
    }

    fn empty_frame(&self, confidence: f32) -> ProcessedHandFrame {
        ProcessedHandFrame {
            detected: false,
            handedness: Handedness::Unknown,
            landmarks: Vec::new(),
            cursor: None,
            finger_states: FingerStates::default(),
            raw_gesture: GestureKind::None,
            stable_gesture: GestureKind::None,
            drawing_state: DrawingState::Idle,
            confidence,
            low_light_warning: self.low_confidence_streak >= 10,
            finger_angles_deg: [0.0; 5],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use drawing::{catmull_rom_spline, render_strokes_to_svg, simplify_stroke};
    use rps::{compute_commitment, evaluate_round, verify_commitment};
    use types::{Point3, RoundOutcome, RpsMove, StrokeDto};

    fn make_synthetic_hand(extended: [bool; 5]) -> [f32; 63] {
        // Construct an anatomical synthetic 21-landmark hand in normalized space
        let mut pts = [Point3::default(); 21];
        pts[0] = Point3::new(0.5, 0.8, 0.0); // Wrist

        // Thumb (1..4)
        pts[1] = Point3::new(0.45, 0.72, 0.0);
        pts[2] = Point3::new(0.41, 0.64, 0.0);
        if extended[0] {
            pts[3] = Point3::new(0.35, 0.56, 0.0);
            pts[4] = Point3::new(0.28, 0.49, 0.0);
        } else {
            pts[3] = Point3::new(0.45, 0.60, -0.02);
            pts[4] = Point3::new(0.52, 0.62, -0.04); // Folded across palm
        }

        let bases_x = [0.44, 0.50, 0.56, 0.62];
        for (f_idx, &bx) in bases_x.iter().enumerate() {
            let base = 5 + f_idx * 4;
            pts[base] = Point3::new(bx, 0.55, 0.0); // MCP
            if extended[f_idx + 1] {
                pts[base + 1] = Point3::new(bx, 0.43, 0.0);
                pts[base + 2] = Point3::new(bx, 0.34, 0.0);
                pts[base + 3] = Point3::new(bx, 0.25, 0.0);
            } else {
                // Folded curl back down toward palm
                pts[base + 1] = Point3::new(bx, 0.50, -0.03);
                pts[base + 2] = Point3::new(bx, 0.59, -0.05);
                pts[base + 3] = Point3::new(bx, 0.66, -0.04);
            }
        }

        let mut flat = [0.0f32; 63];
        for (i, p) in pts.iter().enumerate() {
            flat[i * 3] = p.x;
            flat[i * 3 + 1] = p.y;
            flat[i * 3 + 2] = p.z;
        }
        flat
    }

    #[test]
    fn classifies_rock_paper_scissors_and_point_index() {
        let mut profile = CalibrationProfile::default();
        profile.stability_frames = 3;
        profile.mirror_feed = false;
        let mut pipe = VisionPipeline::new(profile);

        let rock = make_synthetic_hand([false, false, false, false, false]);
        let paper = make_synthetic_hand([true, true, true, true, true]);
        let scissors = make_synthetic_hand([false, true, true, false, false]);
        let point = make_synthetic_hand([false, true, false, false, false]);

        let mut t = 0.0;
        let mut feed = |hand: &[f32; 63]| {
            let mut last = None;
            for _ in 0..3 {
                t += 33.3;
                last = Some(pipe.process_frame(hand, None, Handedness::Right, t, 0.95));
            }
            last.unwrap()
        };

        assert_eq!(feed(&rock).stable_gesture, GestureKind::Rock);
        assert_eq!(feed(&paper).stable_gesture, GestureKind::Paper);
        assert_eq!(feed(&scissors).stable_gesture, GestureKind::Scissors);
        let p_frame = feed(&point);
        assert_eq!(p_frame.stable_gesture, GestureKind::PointIndex);
        assert_eq!(p_frame.drawing_state, DrawingState::Draw);
    }

    #[test]
    fn relaxed_bent_scissors_not_confused_with_rock() {
        let mut profile = CalibrationProfile::default();
        profile.finger_curl_threshold_deg = 55.0; // Even strict legacy threshold must recognize extended Scissors
        profile.stability_frames = 2;
        profile.mirror_feed = false;
        let mut pipe = VisionPipeline::new(profile);

        let mut hand = make_synthetic_hand([false, true, true, false, false]);
        // Slightly bend index & middle tips forward (~55-68 deg total curl) as in natural Scissors
        hand[7 * 3 + 2] = -0.04;
        hand[8 * 3 + 2] = -0.09;
        hand[11 * 3 + 2] = -0.04;
        hand[12 * 3 + 2] = -0.09;

        let _ = pipe.process_frame(&hand, None, Handedness::Right, 0.0, 0.95);
        let res = pipe.process_frame(&hand, None, Handedness::Right, 33.3, 0.95);
        assert_eq!(res.stable_gesture, GestureKind::Scissors);
    }

    #[test]
    fn hysteresis_rejects_single_frame_flicker() {
        let mut profile = CalibrationProfile::default();
        profile.stability_frames = 4;
        let mut pipe = VisionPipeline::new(profile);

        let rock = make_synthetic_hand([false, false, false, false, false]);
        let scissors = make_synthetic_hand([false, true, true, false, false]);

        for i in 0..4 {
            pipe.process_frame(&rock, None, Handedness::Right, i as f64 * 33.0, 0.9);
        }
        // Single transitional frame of Scissors while opening hand should NOT break Rock
        let transient = pipe.process_frame(&scissors, None, Handedness::Right, 165.0, 0.9);
        assert_eq!(transient.stable_gesture, GestureKind::Rock);
    }

    #[test]
    fn smoother_resets_after_tracking_gap() {
        let mut pipe = VisionPipeline::default();
        let hand_a = make_synthetic_hand([false, true, false, false, false]);
        let mut hand_b = hand_a;
        hand_b[8 * 3] = 0.9; // Jump index tip far right

        let _ = pipe.process_frame(&hand_a, None, Handedness::Right, 0.0, 0.95);
        // 500ms gap -> must reset smoother rather than lagging from old position
        let jumped = pipe.process_frame(&hand_b, None, Handedness::Right, 500.0, 0.95);
        assert!(jumped.cursor.unwrap().x < 0.2); // mirrored 0.9 -> ~0.1 immediately
    }

    #[test]
    fn rps_rules_and_commit_reveal_verify() {
        assert_eq!(evaluate_round(RpsMove::Rock, RpsMove::Scissors), RoundOutcome::PlayerWin);
        assert_eq!(evaluate_round(RpsMove::Rock, RpsMove::Paper), RoundOutcome::AiWin);
        assert_eq!(evaluate_round(RpsMove::Paper, RpsMove::Paper), RoundOutcome::Draw);

        let salt = "deadbeef0123456789";
        let commit = compute_commitment(RpsMove::Scissors, salt);
        assert!(verify_commitment(RpsMove::Scissors, salt, &commit));
        assert!(!verify_commitment(RpsMove::Rock, salt, &commit));
    }

    #[test]
    fn stroke_simplifier_spline_and_svg_work() {
        let pts = vec![
            StrokePoint { x: 0.1, y: 0.1 },
            StrokePoint { x: 0.2, y: 0.1001 },
            StrokePoint { x: 0.3, y: 0.1 },
            StrokePoint { x: 0.5, y: 0.5 },
        ];
        let simplified = simplify_stroke(&pts, 0.01);
        assert_eq!(simplified.len(), 3);
        let smooth = catmull_rom_spline(&simplified, 3);
        assert!(smooth.len() > simplified.len());

        let svg = render_strokes_to_svg(
            800,
            600,
            &[StrokeDto {
                id: "s1".into(),
                tool: "pen".into(),
                color: "#22d3ee".into(),
                width: 6.0,
                points: simplified,
            }],
        );
        assert!(svg.contains("<path d="));
        assert!(svg.contains("#22d3ee"));
    }
}
