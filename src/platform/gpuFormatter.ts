/**
 * Formats raw WebGL UNMASKED_RENDERER_WEBGL strings into clean, user-friendly GPU display names.
 * Supports NVIDIA, AMD, Intel, Apple, Qualcomm, and generic graphics adapters.
 */
export function formatGpuName(rawRenderer?: string): string {
  if (!rawRenderer) return "GPU (Hardware Accelerated)";

  let text = rawRenderer.trim();
  if (text.startsWith("ANGLE (") && text.endsWith(")")) {
    text = text.slice(7, -1).trim();
    const commaIdx = text.indexOf(",");
    if (commaIdx !== -1) {
      text = text.slice(commaIdx + 1).trim();
    }
  }

  // Remove trailing driver technical details like "Direct3D11 vs_5_0 ps_5_0, D3D11"
  text = text.replace(/,?\s*Direct3D.*$/i, "");
  text = text.replace(/,?\s*D3D11.*$/i, "");
  text = text.replace(/,?\s*OpenGL.*$/i, "");
  text = text.replace(/,?\s*vs_\d.*$/i, "");
  text = text.trim();

  return text || "GPU (Hardware Accelerated)";
}

/**
 * Returns a concise vendor/category label for toolbars, status indicators, and badges.
 * Examples: "NVIDIA GPU", "AMD GPU", "Intel GPU", "Apple GPU", "GPU Hardware".
 */
export function formatGpuShort(rawRenderer?: string): string {
  const full = (rawRenderer || "").toUpperCase();
  if (full.includes("NVIDIA") || full.includes("GEFORCE") || full.includes("RTX") || full.includes("GTX") || full.includes("QUADRO")) {
    return "NVIDIA GPU";
  }
  if (full.includes("AMD") || full.includes("RADEON")) {
    return "AMD GPU";
  }
  if (full.includes("INTEL") || full.includes("ARC") || full.includes("IRIS") || full.includes("UHD") || full.includes("HD GRAPHICS")) {
    return "Intel GPU";
  }
  if (full.includes("APPLE") || full.includes("M1") || full.includes("M2") || full.includes("M3") || full.includes("M4")) {
    return "Apple GPU";
  }
  if (full.includes("ADRENO") || full.includes("QUALCOMM") || full.includes("SNAPDRAGON")) {
    return "Snapdragon GPU";
  }
  return "GPU Hardware";
}
