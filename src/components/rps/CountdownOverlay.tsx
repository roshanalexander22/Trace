import { AnimatePresence, motion } from "framer-motion";

interface CountdownOverlayProps {
  active: boolean;
  value: 3 | 2 | 1 | 0;
}

export function CountdownOverlay({ active, value }: CountdownOverlayProps) {
  if (!active) return null;

  const label = value > 0 ? String(value) : "SHOOT!";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={label}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={`rounded-3xl border px-8 py-4 text-center shadow-2xl backdrop-blur-md ${
            value === 0
              ? "border-sky-300 bg-sky-50/95 text-sky-700"
              : "border-slate-200 bg-white/90 text-slate-900"
          }`}
        >
          <span className="text-5xl font-black tracking-tight md:text-6xl">{label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

