import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { StrokeDto, StrokePoint } from "../../platform/types";
import { useAppStore } from "../../store/useAppStore";
import { useDrawingStore, type DrawingTool } from "../../store/useDrawingStore";
import { visionBus } from "../../vision/visionBus";
import { mapVideoNormToViewport } from "../../vision/coordinateMapper";
import { CameraPreview } from "../vision/CameraPreview";
import { HandSkeletonOverlay } from "../vision/HandSkeletonOverlay";
import { GestureCursor } from "./GestureCursor";

interface AirCanvasWorkspaceProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  committedCanvasRef: RefObject<HTMLCanvasElement | null>;
  onDwellAction?: () => void;
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (alpha >= 0.99 || !hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) {
    return hex;
  }
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function buildShapePoints(
  tool: DrawingTool,
  start: StrokePoint,
  end: StrokePoint,
): StrokePoint[] {
  if (tool === "line") {
    return [start, end];
  }
  if (tool === "rect") {
    return [
      { x: start.x, y: start.y },
      { x: end.x, y: start.y },
      { x: end.x, y: end.y },
      { x: start.x, y: end.y },
      { x: start.x, y: start.y },
    ];
  }
  if (tool === "circle") {
    const cx = (start.x + end.x) * 0.5;
    const cy = (start.y + end.y) * 0.5;
    const rx = Math.abs(end.x - start.x) * 0.5;
    const ry = Math.abs(end.y - start.y) * 0.5;
    const steps = 36;
    const pts: StrokePoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({
        x: cx + Math.cos(a) * rx,
        y: cy + Math.sin(a) * ry,
      });
    }
    return pts;
  }
  return [start, end];
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawSmoothStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeDto,
  width: number,
  height: number,
) {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = stroke.tool === "highlighter" ? "square" : "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.tool === "highlighter" ? stroke.width * 2 : stroke.width;

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
  }

  const pts = stroke.points.map((p) => ({ x: p.x * width, y: p.y * height }));

  if (stroke.tool === "spray") {
    let seed = hashSeed(stroke.id);
    const nextRand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const radius = Math.max(8, stroke.width * 1.6);
    const particlesPerPt = 14;
    for (const pt of pts) {
      for (let k = 0; k < particlesPerPt; k++) {
        const angle = nextRand() * Math.PI * 2;
        const dist = Math.sqrt(nextRand()) * radius;
        const r = 0.8 + nextRand() * 1.4;
        ctx.beginPath();
        ctx.arc(pt.x + Math.cos(angle) * dist, pt.y + Math.sin(angle) * dist, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (stroke.tool === "line" || stroke.tool === "rect") {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) * 0.5;
    const midY = (pts[i].y + pts[i + 1].y) * 0.5;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

export function AirCanvasWorkspace({
  videoRef,
  stream,
  committedCanvasRef,
  onDwellAction,
}: AirCanvasWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<StrokeDto | null>(null);
  const shapeOriginRef = useRef<StrokePoint | null>(null);
  const mouseDrawingRef = useRef(false);

  const mirror = useAppStore((s) => s.calibration.mirror_feed);
  const strokes = useDrawingStore((s) => s.strokes);
  const cameraMode = useDrawingStore((s) => s.cameraMode);
  const boardOpacity = useDrawingStore((s) => s.boardOpacity);
  const backgroundPattern = useDrawingStore((s) => s.backgroundPattern);
  const commitStroke = useDrawingStore((s) => s.commitStroke);

  const clearLive = useCallback(() => {
    const live = liveCanvasRef.current;
    if (!live) return;
    const ctx = live.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, live.width, live.height);
    ctx.restore();
  }, []);

  const drawLivePreview = useCallback((stroke: StrokeDto) => {
    const live = liveCanvasRef.current;
    if (!live) return;
    const ctx = live.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = live.width / dpr;
    const h = live.height / dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawSmoothStroke(ctx, stroke, w, h);
    ctx.restore();
  }, []);

  const flushActiveStroke = useCallback(() => {
    if (activeStrokeRef.current && activeStrokeRef.current.points.length > 0) {
      commitStroke(activeStrokeRef.current);
    }
    activeStrokeRef.current = null;
    shapeOriginRef.current = null;
    clearLive();
  }, [clearLive, commitStroke]);

  const beginOrAdvanceStroke = useCallback(
    (normPt: StrokePoint) => {
      const { tool, color, brushWidth, strokeOpacity } = useDrawingStore.getState();
      const effectiveAlpha = tool === "highlighter" ? strokeOpacity * 0.36 : strokeOpacity;
      const effectiveColor = hexWithAlpha(color, effectiveAlpha);
      const isShape = tool === "line" || tool === "rect" || tool === "circle";

      if (!activeStrokeRef.current) {
        shapeOriginRef.current = normPt;
        activeStrokeRef.current = {
          id: crypto.randomUUID(),
          tool,
          color: effectiveColor,
          width: brushWidth,
          points: isShape ? [normPt, normPt] : [normPt],
        };
      } else if (isShape && shapeOriginRef.current) {
        activeStrokeRef.current.points = buildShapePoints(tool, shapeOriginRef.current, normPt);
      } else {
        const pts = activeStrokeRef.current.points;
        const last = pts[pts.length - 1];
        const dist = Math.hypot(normPt.x - last.x, normPt.y - last.y);
        if (dist > 0.0022) {
          pts.push(normPt);
        }
      }

      if (activeStrokeRef.current) {
        drawLivePreview(activeStrokeRef.current);
      }
    },
    [drawLivePreview],
  );

  const renderCommitted = useCallback(() => {
    const canvas = committedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of useDrawingStore.getState().strokes) {
      drawSmoothStroke(ctx, s, w, h);
    }
    ctx.restore();
  }, [committedCanvasRef]);

  useEffect(() => {
    renderCommitted();
  }, [strokes, renderCommitted]);

  useEffect(() => {
    const container = containerRef.current;
    const committed = committedCanvasRef.current;
    const live = liveCanvasRef.current;
    if (!container || !committed || !live) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const c of [committed, live]) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
      }
      renderCommitted();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [committedCanvasRef, renderCommitted]);

  // AI Hand Finger Drawing Subscription
  useEffect(() => {
    const unsub = visionBus.subscribe((ev) => {
      if (mouseDrawingRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      if (!ev.frame.detected || !ev.frame.cursor || ev.frame.drawing_state !== "Draw") {
        if (activeStrokeRef.current) {
          flushActiveStroke();
        }
        return;
      }

      const rect = container.getBoundingClientRect();
      const mapped = mapVideoNormToViewport(
        ev.frame.cursor.x,
        ev.frame.cursor.y,
        ev.metrics.videoWidth,
        ev.metrics.videoHeight,
        rect.width,
        rect.height,
        "cover",
      );

      beginOrAdvanceStroke({
        x: Math.max(0, Math.min(1, mapped.x / Math.max(1, rect.width))),
        y: Math.max(0, Math.min(1, mapped.y / Math.max(1, rect.height))),
      });
    });

    return () => {
      unsub();
      if (activeStrokeRef.current) {
        flushActiveStroke();
      }
    };
  }, [beginOrAdvanceStroke, flushActiveStroke]);

  // Direct Mouse / Touch / Stylus Drawing Support
  const pointerToNorm = (e: React.PointerEvent<HTMLDivElement>): StrokePoint | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pt = pointerToNorm(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    mouseDrawingRef.current = true;
    activeStrokeRef.current = null;
    shapeOriginRef.current = null;
    beginOrAdvanceStroke(pt);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mouseDrawingRef.current) return;
    const pt = pointerToNorm(e);
    if (!pt) return;
    beginOrAdvanceStroke(pt);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mouseDrawingRef.current) return;
    mouseDrawingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    flushActiveStroke();
  };

  const handleDwellTrigger = useCallback(
    (btn: HTMLElement) => {
      btn.click();
      onDwellAction?.();
    },
    [onDwellAction],
  );

  const patternStyle =
    backgroundPattern === "dots"
      ? {
          backgroundImage: "radial-gradient(rgba(15, 23, 42, 0.2) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }
      : backgroundPattern === "grid"
        ? {
            backgroundImage:
              "linear-gradient(to right, rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }
        : undefined;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex-1 cursor-crosshair select-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg touch-none"
    >
      {/* Layer 1: Camera Feed */}
      <div
        className={
          cameraMode === "pip"
            ? "pointer-events-none absolute bottom-4 right-4 z-15 h-36 w-52 overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-xl"
            : `pointer-events-none absolute inset-0 transition-opacity duration-200 ${
                cameraMode === "hidden" ? "opacity-0" : "opacity-100"
              }`
        }
      >
        <CameraPreview videoRef={videoRef} stream={stream} mirror={mirror} />
        <HandSkeletonOverlay muted={boardOpacity > 0.55} />
      </div>

      {/* Layer 1.5: Adjustable Drawing Board Backdrop Opacity & Paper Pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-5 transition-opacity duration-100"
        style={{
          backgroundColor: `rgba(255, 255, 255, ${cameraMode === "overlay" ? boardOpacity : 1})`,
          ...patternStyle,
        }}
      />

      {/* Layer 2: Independent HiDPI Vector Drawing Canvases */}
      <canvas
        ref={committedCanvasRef}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />
      <canvas
        ref={liveCanvasRef}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      {/* Smooth Gesture Cursor */}
      <GestureCursor containerRef={containerRef} onDwellTrigger={handleDwellTrigger} />

      {/* Bottom Gesture Guide Pill */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-md backdrop-blur">
        <span>
          <strong className="text-sky-700">☝️ Index</strong> or <strong>Mouse</strong> Draw
        </span>
        <span>•</span>
        <span>
          <strong className="text-indigo-700">✌️ Peace</strong> Hover / Pick Tool
        </span>
        <span>•</span>
        <span>
          <strong className="text-emerald-700">✋ Palm</strong> Stop
        </span>
      </div>
    </div>
  );
}
