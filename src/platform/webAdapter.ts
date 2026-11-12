import type { PlatformAdapter } from "./adapter";
import {
  DEFAULT_CALIBRATION,
  type ArtworkDto,
  type ArtworkMetaDto,
  type CalibrationProfile,
  type RoundOutcome,
  type RpsCommitmentDto,
  type RpsMatchRecordDto,
  type RpsMove,
  type RpsResultDto,
  type ScoreboardSummaryDto,
  type StrokeDto,
  type SystemTelemetryDto,
} from "./types";

const CAL_KEY = "trace.calibration.v1";
const RPS_KEY = "trace.rps.matches.v1";
const ART_KEY = "trace.artworks.v1";

interface PendingWebRound {
  ai_move: RpsMove;
  salt_hex: string;
  commitment_sha256: string;
}

const pendingRounds = new Map<string, PendingWebRound>();

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomRpsMove(): RpsMove {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const idx = buf[0] % 3;
  return idx === 0 ? "Rock" : idx === 1 ? "Paper" : "Scissors";
}

function evalOutcome(player: RpsMove, ai: RpsMove): RoundOutcome {
  if (player === ai) return "Draw";
  if (
    (player === "Rock" && ai === "Scissors") ||
    (player === "Paper" && ai === "Rock") ||
    (player === "Scissors" && ai === "Paper")
  ) {
    return "PlayerWin";
  }
  return "AiWin";
}

function readMatches(): RpsMatchRecordDto[] {
  try {
    const raw = localStorage.getItem(RPS_KEY);
    return raw ? (JSON.parse(raw) as RpsMatchRecordDto[]) : [];
  } catch {
    return [];
  }
}

function summarizeMatches(matches: RpsMatchRecordDto[]): ScoreboardSummaryDto {
  let player_wins = 0;
  let ai_wins = 0;
  let draws = 0;
  for (const m of matches) {
    if (m.outcome === "PlayerWin") player_wins++;
    else if (m.outcome === "AiWin") ai_wins++;
    else draws++;
  }
  let current_streak = 0;
  for (const m of matches) {
    if (m.outcome === "PlayerWin") {
      if (current_streak < 0) break;
      current_streak++;
    } else if (m.outcome === "AiWin") {
      if (current_streak > 0) break;
      current_streak--;
    } else {
      break;
    }
  }
  const decisive = player_wins + ai_wins;
  return {
    player_wins,
    ai_wins,
    draws,
    total_rounds: matches.length,
    current_streak,
    win_rate: decisive > 0 ? player_wins / decisive : 0,
    recent_matches: matches.slice(0, 50),
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class WebAdapter implements PlatformAdapter {
  readonly isTauri = false;

  async loadCalibration(): Promise<CalibrationProfile> {
    try {
      const raw = localStorage.getItem(CAL_KEY);
      return raw ? { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) } : DEFAULT_CALIBRATION;
    } catch {
      return DEFAULT_CALIBRATION;
    }
  }

  async saveCalibration(profile: CalibrationProfile): Promise<void> {
    localStorage.setItem(CAL_KEY, JSON.stringify(profile));
  }

  async rpsStartRound(): Promise<RpsCommitmentDto> {
    const ai_move = randomRpsMove();
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt_hex = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const commitment_sha256 = await sha256Hex(`${ai_move}:${salt_hex}`);
    const round_id = crypto.randomUUID();
    pendingRounds.clear();
    pendingRounds.set(round_id, { ai_move, salt_hex, commitment_sha256 });
    return { round_id, commitment_sha256 };
  }

  async rpsResolveRound(roundId: string, playerMove: RpsMove): Promise<RpsResultDto> {
    const round = pendingRounds.get(roundId);
    if (!round) {
      throw new Error("Round commitment expired or missing");
    }
    pendingRounds.delete(roundId);
    const outcome = evalOutcome(playerMove, round.ai_move);
    const matches = readMatches();
    const record: RpsMatchRecordDto = {
      id: Date.now(),
      player_move: playerMove,
      ai_move: round.ai_move,
      outcome,
      commitment_sha256: round.commitment_sha256,
      salt_hex: round.salt_hex,
      played_at: Math.floor(Date.now() / 1000),
    };
    const next = [record, ...matches].slice(0, 200);
    localStorage.setItem(RPS_KEY, JSON.stringify(next));
    return {
      player_move: playerMove,
      ai_move: round.ai_move,
      outcome,
      commitment_sha256: round.commitment_sha256,
      salt_hex: round.salt_hex,
      scoreboard: summarizeMatches(next),
    };
  }

  async rpsGetScoreboard(): Promise<ScoreboardSummaryDto> {
    return summarizeMatches(readMatches());
  }

  async rpsResetScoreboard(): Promise<void> {
    localStorage.removeItem(RPS_KEY);
  }

  async saveArtwork(artwork: ArtworkDto): Promise<void> {
    const map = this.readArtworksMap();
    map[artwork.id] = { ...artwork, updated_at: Math.floor(Date.now() / 1000) };
    localStorage.setItem(ART_KEY, JSON.stringify(map));
  }

  async listArtworks(): Promise<ArtworkMetaDto[]> {
    return Object.values(this.readArtworksMap())
      .map((a) => ({
        id: a.id,
        title: a.title,
        width: a.width,
        height: a.height,
        stroke_count: a.strokes.length,
        updated_at: a.updated_at,
      }))
      .sort((a, b) => b.updated_at - a.updated_at);
  }

  async loadArtwork(id: string): Promise<ArtworkDto> {
    const art = this.readArtworksMap()[id];
    if (!art) throw new Error("Artwork not found");
    return art;
  }

  async exportArtworkSvg(
    title: string,
    width: number,
    height: number,
    strokes: StrokeDto[],
  ): Promise<string | null> {
    const paths = strokes
      .filter((s) => s.points.length > 0)
      .map((s) => {
        const d = s.points
          .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * width).toFixed(2)} ${(p.y * height).toFixed(2)}`)
          .join(" ");
        const color = s.tool === "eraser" ? "#020617" : s.color;
        return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
      })
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#020617"/>${paths}</svg>`;
    const fileName = `${title.replace(/\s+/g, "_")}.svg`;
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), fileName);
    return fileName;
  }

  async exportArtworkPng(title: string, pngBytes: Uint8Array): Promise<string | null> {
    const fileName = `${title.replace(/\s+/g, "_")}.png`;
    downloadBlob(new Blob([new Uint8Array(pngBytes)], { type: "image/png" }), fileName);
    return fileName;
  }

  async getSystemTelemetry(): Promise<SystemTelemetryDto> {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      memory_mb: mem ? mem.usedJSHeapSize / (1024 * 1024) : 0,
      os_platform: "browser",
    };
  }

  async openCameraPrivacySettings(): Promise<void> {
    // Not applicable in browser sandbox
  }

  async resetWebviewCameraPermissions(): Promise<boolean> {
    return false;
  }

  private readArtworksMap(): Record<string, ArtworkDto> {
    try {
      const raw = localStorage.getItem(ART_KEY);
      return raw ? (JSON.parse(raw) as Record<string, ArtworkDto>) : {};
    } catch {
      return {};
    }
  }
}

