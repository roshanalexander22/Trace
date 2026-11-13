import { describe, expect, it } from "vitest";
import { formatGpuName, formatGpuShort } from "./gpuFormatter";

describe("gpuFormatter", () => {
  it("formats NVIDIA GPUs cleanly from ANGLE strings", () => {
    const raw = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 6GB Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)";
    expect(formatGpuName(raw)).toBe("NVIDIA GeForce RTX 3050 6GB Laptop GPU");
    expect(formatGpuShort(raw)).toBe("NVIDIA GPU");
  });

  it("formats AMD GPUs cleanly", () => {
    const raw = "ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)";
    expect(formatGpuName(raw)).toBe("AMD Radeon(TM) Graphics");
    expect(formatGpuShort(raw)).toBe("AMD GPU");
  });

  it("formats Intel Arc / Iris Xe GPUs cleanly", () => {
    const rawArc = "ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)";
    expect(formatGpuName(rawArc)).toBe("Intel(R) Arc(TM) A770 Graphics");
    expect(formatGpuShort(rawArc)).toBe("Intel GPU");

    const rawIris = "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)";
    expect(formatGpuName(rawIris)).toBe("Intel(R) Iris(R) Xe Graphics");
    expect(formatGpuShort(rawIris)).toBe("Intel GPU");
  });

  it("formats Apple Metal GPUs", () => {
    const raw = "Apple M2 Pro";
    expect(formatGpuName(raw)).toBe("Apple M2 Pro");
    expect(formatGpuShort(raw)).toBe("Apple GPU");
  });

  it("handles missing or empty strings gracefully", () => {
    expect(formatGpuName("")).toBe("GPU (Hardware Accelerated)");
    expect(formatGpuName(undefined)).toBe("GPU (Hardware Accelerated)");
    expect(formatGpuShort("")).toBe("GPU Hardware");
  });
});

