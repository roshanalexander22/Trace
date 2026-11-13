export type Handedness = "Left" | "Right" | "Unknown";

export type GestureKind =
  | "None"
  | "Rock"
  | "Paper"
  | "Scissors"
  | "PointIndex"
  | "PeaceHover"
  | "Unknown";

export type DrawingState = "Idle" | "Hover" | "Draw" | "Pause";

export type RpsMove = "Rock" | "Paper" | "Scissors";

export type RoundOutcome = "PlayerWin" | "AiWin" | "Draw";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  scores: [number, number, number, number, number];
}

export interface ProcessedHandFrame {
  detected: boolean;
  handedness: Handedness;
  landmarks: Point3[];
  cursor: StrokePoint | null;
  finger_states: FingerStates;
  raw_gesture: GestureKind;
  stable_gesture: GestureKind;
  drawing_state: DrawingState;
  confidence: number;
  low_light_warning: boolean;
  finger_angles_deg: [number, number, number, number, number];
}

export interface CalibrationProfile {
  id: string;
  name: string;
  finger_curl_threshold_deg: number;
  thumb_spread_ratio: number;
  stability_frames: number;
  one_euro_min_cutoff: number;
  one_euro_beta: number;
  one_euro_d_cutoff: number;
  preferred_camera_id: string | null;
  mirror_feed: boolean;
  fps_cap: number;
  delegate: string;
}

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  id: "default",
  name: "Default",
  finger_curl_threshold_deg: 72.0,
  thumb_spread_ratio: 1.18,
  stability_frames: 3,
  one_euro_min_cutoff: 4.5,
  one_euro_beta: 0.5,
  one_euro_d_cutoff: 1.0,
  preferred_camera_id: null,
  mirror_feed: true,
  fps_cap: 60,
  delegate: "NVIDIA",
};

export interface StrokeDto {
  id: string;
  tool: string;
  color: string;
  width: number;
  points: StrokePoint[];
}

export interface ArtworkMetaDto {
  id: string;
  title: string;
  width: number;
  height: number;
  stroke_count: number;
  updated_at: number;
}

export interface ArtworkDto {
  id: string;
  title: string;
  width: number;
  height: number;
  strokes: StrokeDto[];
  updated_at: number;
}

export interface RpsCommitmentDto {
  round_id: string;
  commitment_sha256: string;
}

export interface RpsMatchRecordDto {
  id: number;
  player_move: RpsMove;
  ai_move: RpsMove;
  outcome: RoundOutcome;
  commitment_sha256: string;
  salt_hex: string;
  played_at: number;
}

export interface ScoreboardSummaryDto {
  player_wins: number;
  ai_wins: number;
  draws: number;
  total_rounds: number;
  current_streak: number;
  win_rate: number;
  recent_matches: RpsMatchRecordDto[];
}

export interface RpsResultDto {
  player_move: RpsMove;
  ai_move: RpsMove;
  outcome: RoundOutcome;
  commitment_sha256: string;
  salt_hex: string;
  scoreboard: ScoreboardSummaryDto;
}

export interface SystemTelemetryDto {
  memory_mb: number;
  os_platform: string;
}

export type HardwareDelegate = "NVIDIA" | "CPU";

export interface GpuInfoDto {
  active_preference: string;
  detected_gpus: string[];
}

