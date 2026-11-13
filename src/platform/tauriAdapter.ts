import {
  commands,
  type CalibrationProfile_Serialize,
  type RpsResultDto as SpectaRpsResultDto,
  type ScoreboardSummaryDto as SpectaScoreboardDto,
} from "../bindings";
import type { PlatformAdapter } from "./adapter";
import {
  DEFAULT_CALIBRATION,
  type ArtworkDto,
  type ArtworkMetaDto,
  type CalibrationProfile,
  type RpsCommitmentDto,
  type RpsMove,
  type RpsResultDto,
  type ScoreboardSummaryDto,
  type StrokeDto,
  type SystemTelemetryDto,
  type GpuInfoDto,
} from "./types";

function mapCalibration(raw: CalibrationProfile_Serialize): CalibrationProfile {
  return {
    id: raw.id,
    name: raw.name,
    finger_curl_threshold_deg:
      raw.finger_curl_threshold_deg ?? DEFAULT_CALIBRATION.finger_curl_threshold_deg,
    thumb_spread_ratio: raw.thumb_spread_ratio ?? DEFAULT_CALIBRATION.thumb_spread_ratio,
    stability_frames: raw.stability_frames,
    one_euro_min_cutoff: raw.one_euro_min_cutoff ?? DEFAULT_CALIBRATION.one_euro_min_cutoff,
    one_euro_beta: raw.one_euro_beta ?? DEFAULT_CALIBRATION.one_euro_beta,
    one_euro_d_cutoff: raw.one_euro_d_cutoff ?? DEFAULT_CALIBRATION.one_euro_d_cutoff,
    preferred_camera_id: raw.preferred_camera_id,
    mirror_feed: raw.mirror_feed,
    fps_cap: raw.fps_cap,
    delegate: raw.delegate,
  };
}

function mapScoreboard(raw: SpectaScoreboardDto): ScoreboardSummaryDto {
  return {
    player_wins: raw.player_wins,
    ai_wins: raw.ai_wins,
    draws: raw.draws,
    total_rounds: raw.total_rounds,
    current_streak: raw.current_streak,
    win_rate: raw.win_rate ?? 0,
    recent_matches: raw.recent_matches.map((m) => ({
      id: m.id ?? 0,
      player_move: m.player_move,
      ai_move: m.ai_move,
      outcome: m.outcome,
      commitment_sha256: m.commitment_sha256,
      salt_hex: m.salt_hex,
      played_at: m.played_at ?? 0,
    })),
  };
}

function mapResult(raw: SpectaRpsResultDto): RpsResultDto {
  return {
    player_move: raw.player_move,
    ai_move: raw.ai_move,
    outcome: raw.outcome,
    commitment_sha256: raw.commitment_sha256,
    salt_hex: raw.salt_hex,
    scoreboard: mapScoreboard(raw.scoreboard),
  };
}

export class TauriAdapter implements PlatformAdapter {
  readonly isTauri = true;

  async loadCalibration(): Promise<CalibrationProfile> {
    return mapCalibration(await commands.loadCalibration());
  }

  async saveCalibration(profile: CalibrationProfile): Promise<void> {
    await commands.saveCalibration(profile);
  }

  async rpsStartRound(): Promise<RpsCommitmentDto> {
    return await commands.rpsStartRound();
  }

  async rpsResolveRound(roundId: string, playerMove: RpsMove): Promise<RpsResultDto> {
    return mapResult(await commands.rpsResolveRound(roundId, playerMove));
  }

  async rpsGetScoreboard(): Promise<ScoreboardSummaryDto> {
    return mapScoreboard(await commands.rpsGetScoreboard());
  }

  async rpsResetScoreboard(): Promise<void> {
    await commands.rpsResetScoreboard();
  }

  async saveArtwork(artwork: ArtworkDto): Promise<void> {
    await commands.saveArtwork(artwork);
  }

  async listArtworks(): Promise<ArtworkMetaDto[]> {
    const rows = await commands.listArtworks();
    return rows.map((r) => ({
      ...r,
      updated_at: r.updated_at ?? 0,
    }));
  }

  async loadArtwork(id: string): Promise<ArtworkDto> {
    const raw = await commands.loadArtwork(id);
    return {
      id: raw.id,
      title: raw.title,
      width: raw.width,
      height: raw.height,
      updated_at: raw.updated_at ?? 0,
      strokes: raw.strokes.map((s) => ({
        id: s.id,
        tool: s.tool === "eraser" ? "eraser" : "pen",
        color: s.color,
        width: s.width ?? 6,
        points: s.points.map((p) => ({ x: p.x ?? 0, y: p.y ?? 0 })),
      })),
    };
  }

  async exportArtworkSvg(
    title: string,
    width: number,
    height: number,
    strokes: StrokeDto[],
  ): Promise<string | null> {
    return await commands.exportArtworkSvg(title, width, height, strokes);
  }

  async exportArtworkPng(title: string, pngBytes: Uint8Array): Promise<string | null> {
    return await commands.exportArtworkPng(title, Array.from(pngBytes));
  }

  async getSystemTelemetry(): Promise<SystemTelemetryDto> {
    const raw = await commands.getSystemTelemetry();
    return {
      memory_mb: raw.memory_mb ?? 0,
      os_platform: raw.os_platform,
    };
  }

  async getGpuInfo(): Promise<GpuInfoDto> {
    return await commands.getGpuInfo();
  }

  async setGpuPreference(pref: string): Promise<boolean> {
    return await commands.setGpuPreference(pref);
  }

  async restartApplication(): Promise<void> {
    await commands.restartApplication();
  }

  async openCameraPrivacySettings(): Promise<void> {
    await commands.openCameraPrivacySettings();
  }

  async openGraphicsSettings(): Promise<void> {
    await commands.openGraphicsSettings();
  }

  async resetWebviewCameraPermissions(): Promise<boolean> {
    return await commands.resetWebviewCameraPermissions();
  }
}
