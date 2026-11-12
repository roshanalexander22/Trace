import { useEffect, useRef } from "react";
import { visionBus } from "../../vision/visionBus";
import { mapVideoNormToViewport } from "../../vision/coordinateMapper";
import { useDrawingStore } from "../../store/useDrawingStore";

interface GestureCursorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDwellTrigger?: (el: HTMLElement) => void;
}

export function GestureCursor({ containerRef, onDwellTrigger }: GestureCursorProps) {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<SVGCircleElement | null>(null);
  const dwellTargetRef = useRef<{ id: string; startMs: number; triggered: boolean } | null>(null);

  useEffect(() => {
    const DWELL_MS = 650;
    const CIRCUMFERENCE = 2 * Math.PI * 16;

    const unsub = visionBus.subscribe((ev) => {
      const el = cursorRef.current;
      const container = containerRef.current;
      if (!el || !container) return;

      if (!ev.frame.detected || !ev.frame.cursor) {
        el.style.opacity = "0";
        dwellTargetRef.current = null;
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

      const state = ev.frame.drawing_state;
      const { color, tool, brushWidth, dwellToolbar } = useDrawingStore.getState();

      el.style.opacity = "1";
      el.style.transform = `translate3d(${mapped.x}px, ${mapped.y}px, 0) translate(-50%, -50%)`;

      const size = Math.max(14, brushWidth + 8);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;

      if (state === "Draw") {
        el.style.borderColor = tool === "eraser" ? "#e11d48" : color;
        el.style.backgroundColor = tool === "eraser" ? "rgba(225,29,72,0.28)" : color;
        el.style.boxShadow = `0 0 12px ${tool === "eraser" ? "rgba(225,29,72,0.5)" : color}`;
      } else if (state === "Hover") {
        el.style.borderColor = "#0284c7";
        el.style.backgroundColor = "rgba(2,132,199,0.14)";
        el.style.boxShadow = "0 0 10px rgba(2,132,199,0.4)";
      } else {
        el.style.borderColor = "rgba(51,65,85,0.55)";
        el.style.backgroundColor = "transparent";
        el.style.boxShadow = "none";
      }

      // Hands-free dwell toolbar click when in Hover state
      let dwellRatio = 0;
      if (dwellToolbar && state === "Hover") {
        const hit = document.elementFromPoint(rect.left + mapped.x, rect.top + mapped.y);
        const btn = hit?.closest<HTMLElement>("[data-dwell-id]");
        const id = btn?.dataset.dwellId;

        if (btn && id) {
          const now = performance.now();
          if (!dwellTargetRef.current || dwellTargetRef.current.id !== id) {
            dwellTargetRef.current = { id, startMs: now, triggered: false };
          } else {
            const elapsed = now - dwellTargetRef.current.startMs;
            dwellRatio = Math.min(1, elapsed / DWELL_MS);
            if (elapsed >= DWELL_MS && !dwellTargetRef.current.triggered) {
              dwellTargetRef.current.triggered = true;
              onDwellTrigger?.(btn);
            }
          }
        } else {
          dwellTargetRef.current = null;
        }
      } else {
        dwellTargetRef.current = null;
      }

      if (progressRef.current) {
        progressRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - dwellRatio));
        progressRef.current.style.opacity = dwellRatio > 0.05 ? "1" : "0";
      }
    });

    return () => unsub();
  }, [containerRef, onDwellTrigger]);

  return (
    <div
      ref={cursorRef}
      style={{ opacity: 0 }}
      className="pointer-events-none absolute left-0 top-0 z-30 flex items-center justify-center rounded-full border-2 transition-[width,height,background-color,border-color] duration-75"
    >
      <svg className="h-10 w-10 -rotate-90 overflow-visible" viewBox="0 0 40 40">
        <circle
          ref={progressRef}
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="#0284c7"
          strokeWidth="3"
          strokeDasharray={2 * Math.PI * 16}
          strokeDashoffset={2 * Math.PI * 16}
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />
      </svg>
    </div>
  );
}

