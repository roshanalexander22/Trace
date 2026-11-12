import { motion } from "framer-motion";
import { useId } from "react";
import type { RpsMove } from "../../platform/types";

interface HandAnimationProps {
  pose: RpsMove | "idle" | "pumping";
  beat?: number;
  accent?: "cyan" | "rose" | "emerald" | "amber";
  fingerCount?: 0 | 1 | 2 | 3 | 4;
  mirrored?: boolean;
  facing?: "up" | "down";
  sizeClass?: string;
}

const ACCENT_MAP = {
  cyan: {
    ring: "#0ea5e9",
    glow: "rgba(14, 165, 233, 0.22)",
    rim: "#7dd3fc",
  },
  rose: {
    ring: "#f43f5e",
    glow: "rgba(244, 63, 94, 0.22)",
    rim: "#fda4af",
  },
  emerald: {
    ring: "#10b981",
    glow: "rgba(16, 185, 129, 0.24)",
    rim: "#6ee7b7",
  },
  amber: {
    ring: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.24)",
    rim: "#fcd34d",
  },
};

function getFingerExtension(
  pose: RpsMove | "idle" | "pumping",
  fingerCount?: 0 | 1 | 2 | 3 | 4,
) {
  if (typeof fingerCount === "number") {
    return {
      thumb: false,
      index: fingerCount >= 1,
      middle: fingerCount >= 2,
      ring: fingerCount >= 3,
      pinky: fingerCount >= 4,
      dimmed: fingerCount === 0,
    };
  }
  if (pose === "Paper") {
    return { thumb: true, index: true, middle: true, ring: true, pinky: true, dimmed: false };
  }
  if (pose === "Scissors") {
    return { thumb: false, index: true, middle: true, ring: false, pinky: false, dimmed: false };
  }
  // Rock / idle / pumping -> natural closed fist
  return { thumb: false, index: false, middle: false, ring: false, pinky: false, dimmed: false };
}

export function HandAnimation({
  pose,
  beat = 0,
  accent = "cyan",
  fingerCount,
  mirrored = false,
  facing = "up",
  sizeClass = "h-56 w-56",
}: HandAnimationProps) {
  const uid = useId().replace(/:/g, "");
  const palette = ACCENT_MAP[accent];
  const ext = getFingerExtension(pose, fingerCount);
  const isPumping = pose === "pumping";
  const isScissors = pose === "Scissors" || fingerCount === 2;

  const gradSkin = `skin-${uid}`;
  const gradShade = `shade-${uid}`;
  const gradPalm = `palm-${uid}`;
  const gradNail = `nail-${uid}`;

  // Flip SVG cleanly without fighting Framer Motion transforms
  const orientationTransform = [
    mirrored ? "scaleX(-1)" : "",
    facing === "down" ? "rotate(180deg)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`relative flex items-center justify-center select-none ${sizeClass} ${
        ext.dimmed ? "opacity-40 grayscale" : ""
      }`}
    >
      <div
        className="absolute inset-4 rounded-full blur-2xl transition-colors duration-300"
        style={{ background: palette.glow }}
      />

      <div
        className="relative h-full w-full"
        style={orientationTransform ? { transform: orientationTransform } : undefined}
      >
        <motion.svg
          viewBox="0 0 220 250"
          className="h-full w-full drop-shadow-[0_14px_20px_rgba(15,23,42,0.16)]"
          animate={
            isPumping
              ? { y: [0, -18, 0], rotate: [0, -6, 0] }
              : { y: 0, rotate: 0 }
          }
          transition={
            isPumping
              ? { duration: 0.34, ease: "easeOut" }
              : { type: "spring", stiffness: 270, damping: 22 }
          }
          data-beat={beat}
        >
          <defs>
            {/* Warm realistic studio skin gradient */}
            <linearGradient id={gradSkin} x1="0.2" y1="0" x2="0.85" y2="1">
              <stop offset="0%" stopColor="#fde3cf" />
              <stop offset="48%" stopColor="#f2bf9c" />
              <stop offset="100%" stopColor="#d9966f" />
            </linearGradient>

            {/* Deeper anatomical crease & shadow gradient */}
            <linearGradient id={gradShade} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ebb08a" />
              <stop offset="100%" stopColor="#c57f57" />
            </linearGradient>

            {/* Radial highlight across center of palm */}
            <radialGradient id={gradPalm} cx="52%" cy="46%" r="54%">
              <stop offset="0%" stopColor="#ffeadd" stopOpacity="0.85" />
              <stop offset="65%" stopColor="#efc09f" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#c9855e" stopOpacity="0.35" />
            </radialGradient>

            {/* Subtle fingernail highlight */}
            <linearGradient id={gradNail} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff7f2" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#f5c9b0" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {/* Wrist / Forearm base */}
          <path
            d="M78 242 C79 218, 76 198, 74 184 L145 184 C143 198, 141 218, 143 242 Z"
            fill={`url(#${gradShade})`}
            stroke="#a96b47"
            strokeOpacity="0.45"
            strokeWidth="2"
          />

          {/* Pinky Finger pivoted strictly at MCP joint (145, 126) */}
          <g transform="translate(145, 126)">
            <motion.g
              animate={
                ext.pinky
                  ? { rotate: 11, scaleY: 1, opacity: 1 }
                  : { rotate: -2, scaleY: 0.22, opacity: 0 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <path
                d="M-7.5 10 C-8.5 -16, -7 -44, -5 -62 C-4 -70, 6 -70, 7 -62 C9 -44, 8 -16, 7.5 10 Z"
                fill={`url(#${gradSkin})`}
                stroke="#a96b47"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="-3.5" y="-66" width="7.5" height="8.5" rx="3.7" fill={`url(#${gradNail})`} />
              <path d="M-5 -32 Q0 -34 6 -32" stroke="#b97752" strokeOpacity="0.4" strokeWidth="1.3" fill="none" />
              <path d="M-4 -48 Q1 -50 5.5 -48" stroke="#b97752" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
            </motion.g>
          </g>

          {/* Ring Finger pivoted strictly at MCP joint (126, 118) */}
          <g transform="translate(126, 118)">
            <motion.g
              animate={
                ext.ring
                  ? { rotate: 4, scaleY: 1, opacity: 1 }
                  : { rotate: -1, scaleY: 0.22, opacity: 0 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <path
                d="M-8.5 10 C-8.5 -20, -7.5 -52, -5.5 -74 C-4.5 -83, 6.5 -83, 7.5 -74 C9.5 -52, 8.5 -20, 8.5 10 Z"
                fill={`url(#${gradSkin})`}
                stroke="#a96b47"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="-3.5" y="-78" width="8.5" height="9.5" rx="4.2" fill={`url(#${gradNail})`} />
              <path d="M-6 -36 Q0.5 -38 7 -36" stroke="#b97752" strokeOpacity="0.4" strokeWidth="1.3" fill="none" />
              <path d="M-5 -55 Q1 -57 6.5 -55" stroke="#b97752" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
            </motion.g>
          </g>

          {/* Middle Finger pivoted strictly at MCP joint (105, 114) */}
          <g transform="translate(105, 114)">
            <motion.g
              animate={
                ext.middle
                  ? isScissors
                    ? { rotate: 9, scaleY: 1, opacity: 1 }
                    : { rotate: -0.5, scaleY: 1, opacity: 1 }
                  : { rotate: 1, scaleY: 0.22, opacity: 0 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <path
                d="M-9 10 C-9 -22, -8 -58, -6 -82 C-5 -92, 7 -92, 8 -82 C10 -58, 9 -22, 9 10 Z"
                fill={`url(#${gradSkin})`}
                stroke="#a96b47"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="-4" y="-86" width="9" height="10.5" rx="4.5" fill={`url(#${gradNail})`} />
              <path d="M-6 -39 Q0.5 -41 7.5 -39" stroke="#b97752" strokeOpacity="0.4" strokeWidth="1.3" fill="none" />
              <path d="M-5 -60 Q1 -62 7 -60" stroke="#b97752" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
            </motion.g>
          </g>

          {/* Index Finger pivoted strictly at MCP joint (84, 119) */}
          <g transform="translate(84, 119)">
            <motion.g
              animate={
                ext.index
                  ? isScissors
                    ? { rotate: -14, scaleY: 1, opacity: 1 }
                    : { rotate: -5, scaleY: 1, opacity: 1 }
                  : { rotate: 2, scaleY: 0.22, opacity: 0 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              <path
                d="M-8.5 10 C-8.5 -20, -7.5 -52, -5.5 -76 C-4.5 -85, 6.5 -85, 7.5 -76 C9.5 -52, 8.5 -20, 8.5 10 Z"
                fill={`url(#${gradSkin})`}
                stroke="#a96b47"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="-3.5" y="-80" width="8.5" height="9.5" rx="4.2" fill={`url(#${gradNail})`} />
              <path d="M-6 -36 Q0.5 -38 7 -36" stroke="#b97752" strokeOpacity="0.4" strokeWidth="1.3" fill="none" />
              <path d="M-5 -56 Q1 -58 6.5 -56" stroke="#b97752" strokeOpacity="0.35" strokeWidth="1.2" fill="none" />
            </motion.g>
          </g>

          {/* Sculpted Palm & Metacarpal Ridge */}
          <path
            d="M74 188 C66 170, 66 138, 72 121 C76 111, 95 109, 114 111 C134 113, 152 117, 155 128 C159 144, 154 172, 145 188 C134 198, 92 198, 74 188 Z"
            fill={`url(#${gradSkin})`}
            stroke="#a96b47"
            strokeOpacity="0.55"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M76 184 C70 168, 71 141, 76 125 C85 117, 134 117, 149 128 C153 142, 149 169, 142 184 Z"
            fill={`url(#${gradPalm})`}
          />

          {/* Palmar Crease Lines for anatomical depth */}
          <path
            d="M84 140 Q108 134 142 142"
            fill="none"
            stroke="#b06e48"
            strokeOpacity="0.35"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M83 153 C98 154, 110 165, 116 182"
            fill="none"
            stroke="#b06e48"
            strokeOpacity="0.32"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Curled finger knuckles overlay when fingers are folded (Rock / Scissors / numbers < 4) */}
          {(!ext.index || !ext.middle || !ext.ring || !ext.pinky) && (
            <g>
              {!ext.index && (
                <rect
                  x="74"
                  y="113"
                  width="20"
                  height="22"
                  rx="10"
                  fill={`url(#${gradShade})`}
                  stroke="#a96b47"
                  strokeOpacity="0.55"
                  strokeWidth="1.8"
                />
              )}
              {!ext.middle && (
                <rect
                  x="95"
                  y="110"
                  width="20"
                  height="24"
                  rx="10"
                  fill={`url(#${gradShade})`}
                  stroke="#a96b47"
                  strokeOpacity="0.55"
                  strokeWidth="1.8"
                />
              )}
              {!ext.ring && (
                <rect
                  x="116"
                  y="113"
                  width="19"
                  height="22"
                  rx="9.5"
                  fill={`url(#${gradShade})`}
                  stroke="#a96b47"
                  strokeOpacity="0.55"
                  strokeWidth="1.8"
                />
              )}
              {!ext.pinky && (
                <rect
                  x="136"
                  y="119"
                  width="17"
                  height="20"
                  rx="8.5"
                  fill={`url(#${gradShade})`}
                  stroke="#a96b47"
                  strokeOpacity="0.55"
                  strokeWidth="1.8"
                />
              )}
            </g>
          )}

          {/* Thenar bridge + Thumb pivoted strictly at CMC/MCP base (73, 168) inside left palm */}
          <g transform="translate(73, 168)">
            <motion.g
              animate={
                ext.thumb
                  ? { rotate: -36, scaleY: 1 }
                  : { rotate: 46, scaleY: 0.86 }
              }
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
            >
              <path
                d="M-11 12 C-17 -4, -18 -26, -15 -44 C-13 -54, -1 -55, 3 -44 C7 -28, 10 -8, 12 10 Z"
                fill={`url(#${gradSkin})`}
                stroke="#a96b47"
                strokeOpacity="0.58"
                strokeWidth="2.1"
                strokeLinejoin="round"
              />
              <rect x="-12" y="-49" width="8.5" height="9.5" rx="4.2" fill={`url(#${gradNail})`} />
              <path d="M-13 -24 Q-6 -26 1 -24" stroke="#b97752" strokeOpacity="0.38" strokeWidth="1.3" fill="none" />
            </motion.g>
          </g>

          {/* Soft wrist/thenar blend so thumb base flows seamlessly into the palm */}
          <path
            d="M74 185 C67 174, 67 158, 74 148"
            fill="none"
            stroke="#d9966f"
            strokeOpacity="0.5"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Subtle status accent ring on wrist */}
          <path
            d="M78 190 Q110 197 142 190"
            fill="none"
            stroke={palette.ring}
            strokeOpacity="0.55"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </motion.svg>
      </div>
    </div>
  );
}
