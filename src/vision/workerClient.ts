import type { CalibrationProfile, ProcessedHandFrame } from "../platform/types";
import { visionBus } from "./visionBus";

interface WorkerOutMessage {
  type: "READY" | "FRAME_RESULT" | "ERROR";
  activeDelegate?: "GPU" | "CPU";
  frame?: ProcessedHandFrame;
  inferenceMs?: number;
  videoWidth?: number;
  videoHeight?: number;
  timestampMs?: number;
  message?: string;
}

export class VisionWorkerClient {
  private worker: Worker | null = null;
  private offscreen: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private isBusy = false;
  private isReady = false;
  private rafId: number | null = null;
  private lastSubmittedMs = 0;
  private fpsSamples: number[] = [];
  private currentFps = 0;
  private fpsCap = 30;
  private onReadyCallback?: (delegate: "GPU" | "CPU") => void;
  private onErrorCallback?: (msg: string) => void;

  start(
    calibration: CalibrationProfile,
    callbacks?: {
      onReady?: (delegate: "GPU" | "CPU") => void;
      onError?: (msg: string) => void;
    },
  ) {
    this.stop();
    this.fpsCap = calibration.fps_cap || 30;
    this.onReadyCallback = callbacks?.onReady;
    this.onErrorCallback = callbacks?.onError;

    this.worker = new Worker(new URL("./vision.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === "READY") {
        this.isReady = true;
        this.onReadyCallback?.(msg.activeDelegate ?? "GPU");
      } else if (msg.type === "ERROR") {
        this.isBusy = false;
        this.onErrorCallback?.(msg.message ?? "Vision worker initialization failed");
      } else if (msg.type === "FRAME_RESULT" && msg.frame) {
        this.isBusy = false;
        const now = performance.now();
        this.fpsSamples.push(now);
        while (this.fpsSamples.length > 0 && now - this.fpsSamples[0] > 1000) {
          this.fpsSamples.shift();
        }
        this.currentFps = this.fpsSamples.length;

        visionBus.emit({
          frame: msg.frame,
          timestampMs: msg.timestampMs ?? now,
          metrics: {
            fps: this.currentFps,
            inferenceMs: msg.inferenceMs ?? 0,
            activeDelegate: msg.activeDelegate ?? "GPU",
            videoWidth: msg.videoWidth ?? 0,
            videoHeight: msg.videoHeight ?? 0,
          },
        });
      }
    };

    this.worker.postMessage({ type: "INIT", calibration });
  }

  updateCalibration(calibration: CalibrationProfile) {
    this.fpsCap = calibration.fps_cap || 30;
    this.worker?.postMessage({ type: "UPDATE_CALIBRATION", calibration });
  }

  attachVideo(videoRef: { current: HTMLVideoElement | null }) {
    this.detachVideo();

    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      const video = videoRef.current;
      if (!video || !this.worker || !this.isReady || this.isBusy) return;
      if (video.readyState < 2 || video.paused || video.ended) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw <= 0 || vh <= 0) return;

      const now = performance.now();
      const minIntervalMs = 1000 / Math.max(10, this.fpsCap);
      if (now - this.lastSubmittedMs < minIntervalMs) return;

      if (!this.offscreen || this.offscreen.width !== vw || this.offscreen.height !== vh) {
        this.offscreen = new OffscreenCanvas(vw, vh);
        this.offscreenCtx = this.offscreen.getContext("2d", {
          alpha: false,
          desynchronized: true,
        });
      }

      if (!this.offscreenCtx) return;

      this.offscreenCtx.drawImage(video, 0, 0, vw, vh);
      const bitmap = this.offscreen.transferToImageBitmap();
      this.lastSubmittedMs = now;
      this.isBusy = true;
      this.worker.postMessage(
        {
          type: "DETECT_FRAME",
          bitmap,
          timestampMs: now,
          videoWidth: vw,
          videoHeight: vh,
        },
        [bitmap],
      );
    };

    this.rafId = requestAnimationFrame(loop);
  }

  detachVideo() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isBusy = false;
    this.worker?.postMessage({ type: "RESET" });
  }

  stop() {
    this.detachVideo();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.offscreen = null;
    this.offscreenCtx = null;
  }
}

export const workerClient = new VisionWorkerClient();

