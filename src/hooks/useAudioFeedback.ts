import { useCallback, useRef } from "react";

export function useAudioFeedback(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current?.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, [enabled]);

  const playTone = useCallback(
    (freq: number, durationMs: number, type: OscillatorType = "sine", gainVal = 0.08) => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    },
    [getCtx],
  );

  return {
    playTick: () => playTone(520, 90, "triangle", 0.06),
    playShoot: () => playTone(780, 140, "sine", 0.09),
    playWin: () => {
      playTone(523.25, 110, "triangle", 0.08);
      setTimeout(() => playTone(659.25, 110, "triangle", 0.08), 90);
      setTimeout(() => playTone(783.99, 200, "triangle", 0.09), 180);
    },
    playLose: () => {
      playTone(340, 140, "sawtooth", 0.05);
      setTimeout(() => playTone(260, 220, "sawtooth", 0.05), 120);
    },
    playDraw: () => playTone(440, 150, "sine", 0.06),
    playClick: () => playTone(680, 45, "sine", 0.04),
  };
}

