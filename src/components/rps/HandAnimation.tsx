import { motion } from "framer-motion";
import type { RpsMove } from "../../platform/types";

interface HandAnimationProps {
  pose: RpsMove | "idle" | "pumping";
  beat?: number;
  accent?: "cyan" | "rose" | "emerald" | "amber";
}

const ACCENT_MAP = {
  cyan: { stroke: "#0284c7", fill: "#e0f2fe", glow: "rgba(14,165,233,0.22)" },
  rose: { stroke: "#e11d48", fill: "#ffe4e6", glow: "rgba(244,63,94,0.22)" },
  emerald: { stroke: "#059669", fill: "#d1fae5", glow: "rgba(16,185,129,0.22)" },
  amber: { stroke: "#d97706", fill: "#fef3c7", glow: "rgba(245,158,11,0.22)" },
};

export function HandAnimation({ pose, beat = 0, accent = "cyan" }: HandAnimationProps) {
  const palette = ACCENT_MAP[accent];

  const isPaper = pose === "Paper";
  const isScissors = pose === "Scissors";
  const isPumping = pose === "pumping";

  return (
    <div className="relative flex h-56 w-56 items-center justify-center select-none">
      <div
        className="absolute inset-4 rounded-full blur-2xl transition-colors duration-300"
        style={{ background: palette.glow }}
      />
      <motion.svg
        viewBox="0 0 200 220"
        className="relative h-full w-full drop-shadow-xl"
        animate={
          isPumping
            ? {
                y: [0, -22, 0],
                rotate: [0, -6, 0],
              }
            : { y: 0, rotate: 0 }
        }
        key={isPumping ? `pump-${beat}` : pose}
        transition={
          isPumping
            ? { duration: 0.35, ease: "easeOut" }
            : { type: "spring", stiffness: 280, damping: 20 }
        }
      >
        {/* Wrist & Palm */}
        <path
          d="M65 185 L65 130 C65 108 75 98 100 98 C125 98 135 108 135 130 L135 185 Z"
          fill={palette.fill}
          stroke={palette.stroke}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Pinky */}
        <motion.g
          style={{ originX: "126px", originY: "110px" }}
          animate={
            isPaper
              ? { scaleY: 1, y: 0, rotate: 12 }
              : { scaleY: 0.38, y: 24, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <rect
            x="119"
            y="55"
            width="14"
            height="58"
            rx="7"
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="3"
          />
        </motion.g>

        {/* Ring Finger */}
        <motion.g
          style={{ originX: "109px", originY: "104px" }}
          animate={
            isPaper
              ? { scaleY: 1, y: 0, rotate: 4 }
              : { scaleY: 0.36, y: 26, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <rect
            x="102"
            y="42"
            width="15"
            height="66"
            rx="7.5"
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="3"
          />
        </motion.g>

        {/* Middle Finger */}
        <motion.g
          style={{ originX: "91px", originY: "102px" }}
          animate={
            isPaper
              ? { scaleY: 1, y: 0, rotate: -3 }
              : isScissors
                ? { scaleY: 1, y: 0, rotate: 10 }
                : { scaleY: 0.35, y: 28, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <rect
            x="84"
            y="34"
            width="15"
            height="72"
            rx="7.5"
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="3"
          />
        </motion.g>

        {/* Index Finger */}
        <motion.g
          style={{ originX: "74px", originY: "106px" }}
          animate={
            isPaper
              ? { scaleY: 1, y: 0, rotate: -10 }
              : isScissors
                ? { scaleY: 1, y: 0, rotate: -14 }
                : { scaleY: 0.36, y: 26, rotate: 0 }
          }
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <rect
            x="66"
            y="44"
            width="15"
            height="64"
            rx="7.5"
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="3"
          />
        </motion.g>

        {/* Thumb */}
        <motion.g
          style={{ originX: "68px", originY: "145px" }}
          animate={
            isPaper
              ? { rotate: -48, x: -6, y: -4 }
              : { rotate: 18, x: 14, y: -12 }
          }
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <rect
            x="48"
            y="108"
            width="16"
            height="46"
            rx="8"
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth="3"
          />
        </motion.g>

        {/* Knuckle crease accent */}
        <path
          d="M78 138 Q100 132 122 138"
          fill="none"
          stroke={palette.stroke}
          strokeOpacity="0.45"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </motion.svg>
    </div>
  );
}

