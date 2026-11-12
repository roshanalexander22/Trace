import { beforeEach, describe, expect, it } from "vitest";
import { WebAdapter } from "./webAdapter";

describe("WebAdapter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("runs cryptographic commit-reveal RPS round and updates scoreboard", async () => {
    const adapter = new WebAdapter();
    const commit = await adapter.rpsStartRound();
    expect(commit.round_id).toBeTruthy();
    expect(commit.commitment_sha256).toHaveLength(64);

    const result = await adapter.rpsResolveRound(commit.round_id, "Rock");
    expect(result.scoreboard.total_rounds).toBe(1);
    expect(result.commitment_sha256).toBe(commit.commitment_sha256);

    // Verify SHA-256 commitment independently
    const bytes = new TextEncoder().encode(`${result.ai_move}:${result.salt_hex}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hex).toBe(result.commitment_sha256);
  });

  it("persists and reloads calibration and artworks", async () => {
    const adapter = new WebAdapter();
    const cal = await adapter.loadCalibration();
    await adapter.saveCalibration({ ...cal, stability_frames: 6 });
    const loaded = await adapter.loadCalibration();
    expect(loaded.stability_frames).toBe(6);

    await adapter.saveArtwork({
      id: "art-1",
      title: "Test Sketch",
      width: 800,
      height: 600,
      strokes: [
        {
          id: "s1",
          tool: "pen",
          color: "#22d3ee",
          width: 6,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.9 },
          ],
        },
      ],
      updated_at: 0,
    });

    const list = await adapter.listArtworks();
    expect(list).toHaveLength(1);
    expect(list[0].stroke_count).toBe(1);
  });
});

