import { useEffect, useRef } from "react";
import { useAppStore } from "../../store/useAppStore";
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

const SLOT_PALETTE = {
  Left: {
    stroke: "rgba(14, 165, 233, 0.88)",
    strokeMuted: "rgba(2, 132, 199, 0.35)",
    joint: "#0284c7",
    tipIndex: "#e11d48",
    badgeBg: "rgba(14, 165, 233, 0.92)",
  },
  Right: {
    stroke: "rgba(139, 92, 246, 0.88)",
    strokeMuted: "rgba(109, 40, 217, 0.35)",
    joint: "#7c3aed",
    tipIndex: "#e11d48",
    badgeBg: "rgba(124, 58, 237, 0.92)",
  },
} as const;

interface HandSkeletonOverlayProps {
  className?: string;
  fit?: "cover" | "contain";
  muted?: boolean;
  showBadges?: boolean;
}

export function HandSkeletonOverlay({
  className = "",
  fit = "cover",
  muted = false,
  showBadges = false,
}: HandSkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!cameraEnabled) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

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

      const handsToDraw =
        ev.hands && ev.hands.length > 0
          ? ev.hands.filter((h) => h.landmarks.length >= 21)
          : ev.frame.detected && ev.frame.landmarks.length >= 21
            ? [
                {
                  slot: (ev.frame.handedness === "Right" ? "Right" : "Left") as "Left" | "Right",
                  fingerCount: 0,
                  landmarks: ev.frame.landmarks,
                },
              ]
            : [];

      if (handsToDraw.length === 0) {
        ctx.restore();
        return;
      }

      for (const hand of handsToDraw) {
        const colors = SLOT_PALETTE[hand.slot] ?? SLOT_PALETTE.Left;
        const pts = hand.landmarks.map((lm) =>
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
        ctx.strokeStyle = muted ? colors.strokeMuted : colors.stroke;
        ctx.lineWidth = muted ? 1.5 : 2.8;
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
          ctx.arc(pts[i].x, pts[i].y, isTip ? (muted ? 3.5 : 5.5) : muted ? 2 : 3.6, 0, Math.PI * 2);
          if (i === 8) {
            ctx.fillStyle = muted ? "rgba(225, 29, 72, 0.65)" : colors.tipIndex;
          } else if (isTip) {
            ctx.fillStyle = muted ? "rgba(2, 132, 199, 0.55)" : "#ffffff";
          } else {
            ctx.fillStyle = muted ? "rgba(100, 116, 139, 0.45)" : colors.joint;
          }
          ctx.fill();
          if (isTip && !muted) {
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = colors.joint;
            ctx.stroke();
          }
        }

        // Optional floating per-hand slot & finger-count badge near wrist
        if (showBadges && !muted) {
          const wrist = pts[0];
          const label = `${hand.slot[0]} · ${hand.fingerCount}`;
          ctx.font = "700 11px Inter, system-ui, sans-serif";
          const padX = 8;
          const textW = ctx.measureText(label).width;
          const pillW = textW + padX * 2;
          const pillH = 22;
          const bx = Math.max(8, Math.min(viewW - pillW - 8, wrist.x - pillW / 2));
          const by = Math.max(8, Math.min(viewH - pillH - 8, wrist.y + 14));

          ctx.fillStyle = colors.badgeBg;
          ctx.beginPath();
          ctx.roundRect(bx, by, pillW, pillH, 999);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.textBaseline = "middle";
          ctx.fillText(label, bx + padX, by + pillH / 2 + 0.5);
        }
      }

      ctx.restore();
    });

    return () => {
      ro.disconnect();
      unsub();
    };
  }, [fit, muted, showBadges, cameraEnabled]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}

