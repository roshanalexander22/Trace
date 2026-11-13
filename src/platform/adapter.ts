import type {
  ArtworkDto,
  ArtworkMetaDto,
  CalibrationProfile,
  GpuInfoDto,
  RpsCommitmentDto,
  RpsMove,
  RpsResultDto,
  ScoreboardSummaryDto,
  StrokeDto,
  SystemTelemetryDto,
} from "./types";

export interface PlatformAdapter {
  readonly isTauri: boolean;

  loadCalibration(): Promise<CalibrationProfile>;
  saveCalibration(profile: CalibrationProfile): Promise<void>;

  rpsStartRound(): Promise<RpsCommitmentDto>;
  rpsResolveRound(roundId: string, playerMove: RpsMove): Promise<RpsResultDto>;
  rpsGetScoreboard(): Promise<ScoreboardSummaryDto>;
  rpsResetScoreboard(): Promise<void>;

  saveArtwork(artwork: ArtworkDto): Promise<void>;
  listArtworks(): Promise<ArtworkMetaDto[]>;
  loadArtwork(id: string): Promise<ArtworkDto>;

  exportArtworkSvg(
    title: string,
    width: number,
    height: number,
    strokes: StrokeDto[],
  ): Promise<string | null>;

  exportArtworkPng(title: string, pngBytes: Uint8Array): Promise<string | null>;

  getSystemTelemetry(): Promise<SystemTelemetryDto>;
  getGpuInfo(): Promise<GpuInfoDto>;
  setGpuPreference(pref: string): Promise<boolean>;
  restartApplication(): Promise<void>;
  openCameraPrivacySettings(): Promise<void>;
  openGraphicsSettings(): Promise<void>;
  resetWebviewCameraPermissions(): Promise<boolean>;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__);
}

