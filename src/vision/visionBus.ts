import type { ProcessedHandFrame } from "../platform/types";

export interface VisionMetrics {
  fps: number;
  inferenceMs: number;
  activeDelegate: "GPU" | "CPU";
  videoWidth: number;
  videoHeight: number;
}

export interface VisionFrameEvent {
  frame: ProcessedHandFrame;
  metrics: VisionMetrics;
  timestampMs: number;
}

type FrameListener = (event: VisionFrameEvent) => void;

class VisionBus {
  private listeners = new Set<FrameListener>();
  public latest: VisionFrameEvent | null = null;

  subscribe(fn: FrameListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  emit(event: VisionFrameEvent): void {
    this.latest = event;
    for (const fn of this.listeners) {
      fn(event);
    }
  }
}

export const visionBus = new VisionBus();

