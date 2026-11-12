import { describe, expect, it } from "vitest";
import { mapVideoNormToViewport } from "./coordinateMapper";

describe("mapVideoNormToViewport", () => {
  it("maps exact aspect ratio 1:1", () => {
    const pt = mapVideoNormToViewport(0.5, 0.25, 1280, 720, 1280, 720, "cover");
    expect(pt.x).toBeCloseTo(640);
    expect(pt.y).toBeCloseTo(180);
  });

  it("accounts for object-cover horizontal crop in portrait container", () => {
    // 16:9 video (1280x720) inside 1:1 square container (400x400)
    // Scaled height = 400 -> scaled width = 400 * 16/9 = 711.11, offsetX = (400 - 711.11)/2 = -155.55
    const center = mapVideoNormToViewport(0.5, 0.5, 1280, 720, 400, 400, "cover");
    expect(center.x).toBeCloseTo(200);
    expect(center.y).toBeCloseTo(200);

    const leftEdge = mapVideoNormToViewport(0, 0.5, 1280, 720, 400, 400, "cover");
    expect(leftEdge.x).toBeLessThan(0);
  });

  it("accounts for object-contain letterboxing", () => {
    // 16:9 video inside 400x400 contain -> renderW = 400, renderH = 225, offsetY = 87.5
    const top = mapVideoNormToViewport(0.5, 0, 1280, 720, 400, 400, "contain");
    expect(top.x).toBeCloseTo(200);
    expect(top.y).toBeCloseTo(87.5);
  });
});

