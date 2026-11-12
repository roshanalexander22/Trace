export interface MappedPoint {
  x: number;
  y: number;
}

/**
 * Maps normalized [0..1] mirrored video coordinates onto a rendered viewport container,
 * accurately accounting for CSS `object-cover` cropping or `object-contain` letterboxing.
 */
export function mapVideoNormToViewport(
  nx: number,
  ny: number,
  videoWidth: number,
  videoHeight: number,
  viewWidth: number,
  viewHeight: number,
  fit: "cover" | "contain" = "cover",
): MappedPoint {
  if (videoWidth <= 0 || videoHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) {
    return { x: nx * viewWidth, y: ny * viewHeight };
  }

  const videoAspect = videoWidth / videoHeight;
  const viewAspect = viewWidth / viewHeight;

  let renderW = viewWidth;
  let renderH = viewHeight;
  let offsetX = 0;
  let offsetY = 0;

  const scaleByWidth = fit === "cover" ? viewAspect > videoAspect : viewAspect < videoAspect;

  if (scaleByWidth) {
    renderW = viewWidth;
    renderH = viewWidth / videoAspect;
    offsetY = (viewHeight - renderH) * 0.5;
  } else {
    renderH = viewHeight;
    renderW = viewHeight * videoAspect;
    offsetX = (viewWidth - renderW) * 0.5;
  }

  return {
    x: offsetX + nx * renderW,
    y: offsetY + ny * renderH,
  };
}

