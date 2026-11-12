use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct Point3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl Point3 {
    #[inline]
    pub const fn new(x: f32, y: f32, z: f32) -> Self {
        Self { x, y, z }
    }

    #[inline]
    pub fn sub(self, other: Self) -> Self {
        Self::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    #[inline]
    pub fn dot(self, other: Self) -> f32 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    #[inline]
    pub fn norm(self) -> f32 {
        self.dot(self).sqrt()
    }

    #[inline]
    pub fn dist(self, other: Self) -> f32 {
        self.sub(other).norm()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub enum Handedness {
    Left,
    Right,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct FingerStates {
    pub thumb: bool,
    pub index: bool,
    pub middle: bool,
    pub ring: bool,
    pub pinky: bool,
    /// Continuous 0..1 confidence score per finger [thumb, index, middle, ring, pinky].
    pub scores: [f32; 5],
}

impl FingerStates {
    pub fn bitmask(&self) -> [u8; 5] {
        [
            u8::from(self.thumb),
            u8::from(self.index),
            u8::from(self.middle),
            u8::from(self.ring),
            u8::from(self.pinky),
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub enum GestureKind {
    #[default]
    None,
    Rock,
    Paper,
    Scissors,
    PointIndex,
    PeaceHover,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub enum DrawingState {
    #[default]
    Idle,
    Hover,
    Draw,
    Pause,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub enum RpsMove {
    #[default]
    Rock,
    Paper,
    Scissors,
}

impl RpsMove {
    pub fn from_gesture(gesture: GestureKind) -> Option<Self> {
        match gesture {
            GestureKind::Rock => Some(Self::Rock),
            GestureKind::Paper => Some(Self::Paper),
            GestureKind::Scissors | GestureKind::PeaceHover => Some(Self::Scissors),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub enum RoundOutcome {
    PlayerWin,
    AiWin,
    Draw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct CalibrationProfile {
    pub id: String,
    pub name: String,
    pub finger_curl_threshold_deg: f32,
    pub thumb_spread_ratio: f32,
    pub stability_frames: u8,
    pub one_euro_min_cutoff: f32,
    pub one_euro_beta: f32,
    pub one_euro_d_cutoff: f32,
    pub preferred_camera_id: Option<String>,
    pub mirror_feed: bool,
    pub fps_cap: u32,
    pub delegate: String,
}

impl Default for CalibrationProfile {
    fn default() -> Self {
        Self {
            id: "default".to_string(),
            name: "Default".to_string(),
            finger_curl_threshold_deg: 72.0,
            thumb_spread_ratio: 1.18,
            stability_frames: 4,
            one_euro_min_cutoff: 1.4,
            one_euro_beta: 0.05,
            one_euro_d_cutoff: 1.0,
            preferred_camera_id: None,
            mirror_feed: true,
            fps_cap: 30,
            delegate: "GPU".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct StrokePoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct StrokeDto {
    pub id: String,
    pub tool: String,
    pub color: String,
    pub width: f32,
    pub points: Vec<StrokePoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedHandFrame {
    pub detected: bool,
    pub handedness: Handedness,
    /// Mirrored & smoothed 21 screen landmarks `[x, y, z]`.
    pub landmarks: Vec<Point3>,
    /// Smoothed cursor point in normalized `[0..1]` mirrored image coordinates (Index tip = 8).
    pub cursor: Option<StrokePoint>,
    pub finger_states: FingerStates,
    pub raw_gesture: GestureKind,
    pub stable_gesture: GestureKind,
    pub drawing_state: DrawingState,
    pub confidence: f32,
    pub low_light_warning: bool,
    /// Cumulative finger curl angles in degrees `[thumb_ip, index, middle, ring, pinky]`.
    pub finger_angles_deg: [f32; 5],
}

