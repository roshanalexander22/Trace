import { useEffect, useRef } from "react";
import { visionBus } from "../../vision/visionBus";
import { mapVideoNormToViewport } from "../../vision/coordinateMapper";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

interface HandSkeletonOverlayProps {
  className?: string;
  fit?: "cover" | "contain";
  muted?: boolean;
}

export function HandSkeletonOverlay({
  className = "",
  fit = "cover",
  muted = false,
}: HandSkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const unsub = visionBus.subscribe((ev) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewW, viewH);

      if (!ev.frame.detected || ev.frame.landmarks.length < 21) {
        ctx.restore();
        return;
      }

      const pts = ev.frame.landmarks.map((lm) =>
        mapVideoNormToViewport(
          lm.x,
          lm.y,
          ev.metrics.videoWidth,
          ev.metrics.videoHeight,
          viewW,
          viewH,
          fit,
        ),
      );

      // Draw bones
      ctx.strokeStyle = muted ? "rgba(2, 132, 199, 0.35)" : "rgba(14, 165, 233, 0.85)";
      ctx.lineWidth = muted ? 1.5 : 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();

      // Draw landmarks
      for (let i = 0; i < pts.length; i++) {
        const isTip = FINGERTIPS.has(i);
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, isTip ? (muted ? 3.5 : 5.5) : muted ? 2 : 3.5, 0, Math.PI * 2);
        if (i === 8) {
          ctx.fillStyle = muted ? "rgba(225, 29, 72, 0.65)" : "#e11d48";
        } else if (isTip) {
          ctx.fillStyle = muted ? "rgba(2, 132, 199, 0.55)" : "#ffffff";
        } else {
          ctx.fillStyle = muted ? "rgba(100, 116, 139, 0.45)" : "#0284c7";
        }
        ctx.fill();
      }

      ctx.restore();
    });

    return () => {
      ro.disconnect();
      unsub();
    };
  }, [fit, muted]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}

