import type { CalibrationProfile, ProcessedHandFrame } from "../platform/types";
import { visionBus, type DetectedHandSummary } from "./visionBus";

interface WorkerOutMessage {
  type: "READY" | "FRAME_RESULT" | "ERROR";
  activeDelegate?: string;
  rendererName?: string;
  frame?: ProcessedHandFrame;
  hands?: DetectedHandSummary[];
  inferenceMs?: number;
  videoWidth?: number;
  videoHeight?: number;
  timestampMs?: number;
  message?: string;
}

function normalizeDelegate(raw?: string): "NVIDIA" | "CPU" {
  const d = (raw || "NVIDIA").toUpperCase();
  if (d === "CPU") return "CPU";
  return "NVIDIA";
}

export class VisionWorkerClient {
  private worker: Worker | null = null;
  private offscreen: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private isBusy = false;
  private isReady = false;
  private isSwitching = false;
  private currentDelegate = "NVIDIA";
  private rafId: number | null = null;
  private watchdogTimerId: number | null = null;
  private lastSubmittedMs = 0;
  private lastFrameReceivedMs = 0;
  private lastMediaPipeTimestamp = 0;
  private frameCounter = 0;
  private fpsSamples: number[] = [];
  private currentFps = 0;
  private fpsCap = 30;
  private consecutiveNoHandFrames = 0;
  private onReadyCallback?: (delegate: string) => void;
  private onErrorCallback?: (msg: string) => void;
  private attachedVideoRef: { current: HTMLVideoElement | null } | null = null;

  // Auto-recovery watchdog fields
  private lowFpsStreakStartMs = 0;
  private lastAutoRefreshMs = 0;
  private attachTimestampMs = 0;

  start(
    calibration: CalibrationProfile,
    callbacks?: {
      onReady?: (delegate: string) => void;
      onError?: (msg: string) => void;
    },
  ) {
    this.stop();
    this.fpsCap = calibration.fps_cap || 30;
    this.currentDelegate = normalizeDelegate(calibration.delegate);
    this.isSwitching = false;
    this.consecutiveNoHandFrames = 0;
    this.lastSubmittedMs = performance.now();
    this.lastFrameReceivedMs = performance.now();
    this.lastMediaPipeTimestamp = 0;
    this.frameCounter = 0;
    this.fpsSamples = [];
    this.lowFpsStreakStartMs = 0;
    this.lastAutoRefreshMs = 0;
    this.onReadyCallback = callbacks?.onReady;
    this.onErrorCallback = callbacks?.onError;

    this.worker = new Worker(new URL("./vision.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === "READY") {
        this.isReady = true;
        this.isBusy = false;
        this.isSwitching = false;
        this.lastSubmittedMs = performance.now();
        this.lastFrameReceivedMs = performance.now();
        this.onReadyCallback?.(msg.activeDelegate ?? "NVIDIA");
      } else if (msg.type === "ERROR") {
        this.isBusy = false;
        this.isSwitching = false;
        this.onErrorCallback?.(msg.message ?? "Vision worker initialization failed");
      } else if (msg.type === "FRAME_RESULT" && msg.frame) {
        this.isBusy = false;
        this.lastFrameReceivedMs = performance.now();

        if (this.isSwitching) {
          return;
        }

        const hasHands = Boolean(
          msg.frame.detected &&
          (msg.hands ? msg.hands.length > 0 : (msg.frame.landmarks?.length ?? 0) >= 21)
        );

        if (hasHands) {
          this.consecutiveNoHandFrames = 0;
        } else {
          this.consecutiveNoHandFrames++;
        }

        const now = performance.now();
        this.fpsSamples.push(now);
        if (this.fpsSamples.length > 15) {
          this.fpsSamples.shift();
        }
        if (this.fpsSamples.length >= 2) {
          const windowMs = now - this.fpsSamples[0];
          if (windowMs > 0) {
            this.currentFps = Math.round(((this.fpsSamples.length - 1) * 1000) / windowMs);
          }
        }

        visionBus.emit({
          frame: msg.frame,
          hands: msg.hands,
          timestampMs: msg.timestampMs ?? now,
          metrics: {
            fps: this.currentFps,
            inferenceMs: msg.inferenceMs ?? 0,
            activeDelegate: msg.activeDelegate ?? "NVIDIA",
            rendererName: msg.rendererName,
            videoWidth: msg.videoWidth ?? 0,
            videoHeight: msg.videoHeight ?? 0,
          },
        });
      }
    };

    this.worker.postMessage({ type: "INIT", calibration });
    this.startWatchdog();
  }

  updateCalibration(calibration: CalibrationProfile) {
    const prevCap = this.fpsCap;
    this.fpsCap = calibration.fps_cap || 30;
    const nextDelegate = normalizeDelegate(calibration.delegate);

    // Pause incoming video frames during delegate transition to prevent backlog queue desync
    if (this.currentDelegate !== nextDelegate) {
      this.currentDelegate = nextDelegate;
      this.isSwitching = true;
      this.isBusy = false;
      this.worker?.postMessage({ type: "UPDATE_CALIBRATION", calibration });
      return;
    }

    if (prevCap !== this.fpsCap) {
      this.lastSubmittedMs = performance.now();
      this.fpsSamples = [];
      this.lowFpsStreakStartMs = 0;
    }

    this.worker?.postMessage({ type: "UPDATE_CALIBRATION", calibration });
  }

  private startWatchdog() {
    if (this.watchdogTimerId !== null) return;
    this.watchdogTimerId = window.setInterval(() => this.runWatchdogCheck(), 200);
  }

  private stopWatchdog() {
    if (this.watchdogTimerId !== null) {
      clearInterval(this.watchdogTimerId);
      this.watchdogTimerId = null;
    }
  }

  /**
   * Autonomous watchdog that checks for:
   * 1. Hung frames / stuck isBusy state (> 200ms)
   * 2. Hard frame freeze / dropped worker messages (> 450ms)
   * 3. Performance degradation / driver throttle below acceptable FPS
   * Automatically refreshes the engine without requiring any user intervention.
   */
  private runWatchdogCheck() {
    const video = this.attachedVideoRef?.current;
    if (!video || !this.worker || !this.isReady || this.isSwitching) return;
    if (video.readyState < 2 || video.paused || video.ended) return;

    const now = performance.now();

    // 1. Clear stuck busy flag if worker hasn't responded within 200ms
    if (this.isBusy && now - this.lastSubmittedMs > 200) {
      this.isBusy = false;
    }

    // Only assess performance after warmup period of 1500ms
    if (now - this.attachTimestampMs < 1500) return;

    // 2. Hard stall detection: no frame received for > 450ms while video is active
    if (this.lastFrameReceivedMs > 0 && now - this.lastFrameReceivedMs > 450) {
      if (now - this.lastAutoRefreshMs > 3000) {
        this.lastAutoRefreshMs = now;
        console.warn(
          `[VisionWatchdog] Hard frame freeze detected (${Math.round(now - this.lastFrameReceivedMs)}ms since last frame). Auto-refreshing vision engine...`
        );
        this.refreshEngine();
        return;
      }
    }

    // 3. Low/Capped FPS detection:
    // Determine the minimum acceptable FPS based on the configured fpsCap:
    // - 60 FPS cap: anything below 28 FPS indicates driver/power throttle
    // - 30 FPS cap: anything below 16 FPS indicates driver/power throttle
    // - 15 FPS cap: anything below 9 FPS indicates driver/power throttle
    const minAcceptableFps = this.fpsCap >= 55 ? 28 : this.fpsCap >= 25 ? 16 : 9;

    if (this.currentFps > 0 && this.currentFps < minAcceptableFps) {
      if (this.lowFpsStreakStartMs === 0) {
        this.lowFpsStreakStartMs = now;
      } else if (now - this.lowFpsStreakStartMs > 800 && now - this.lastAutoRefreshMs > 3000) {
        this.lastAutoRefreshMs = now;
        this.lowFpsStreakStartMs = 0;
        console.warn(
          `[VisionWatchdog] FPS capped below threshold (${this.currentFps} FPS < ${minAcceptableFps} FPS target for cap ${this.fpsCap}). Auto-refreshing vision engine...`
        );
        this.refreshEngine();
        return;
      }
    } else {
      this.lowFpsStreakStartMs = 0;
    }
  }

  public refreshEngine() {
    const ref = this.attachedVideoRef;
    if (!ref) return;
    this.detachVideo(false);
    this.isBusy = false;
    this.consecutiveNoHandFrames = 0;
    this.fpsSamples = [];
    this.lastSubmittedMs = performance.now();
    this.lastFrameReceivedMs = performance.now();
    this.lowFpsStreakStartMs = 0;
    this.offscreen = null;
    this.offscreenCtx = null;
    this.worker?.postMessage({ type: "RESET" });
    this.attachVideo(ref);
  }

  attachVideo(videoRef: { current: HTMLVideoElement | null }) {
    this.detachVideo(false);
    this.attachedVideoRef = videoRef;
    this.attachTimestampMs = performance.now();
    this.lastSubmittedMs = performance.now();
    this.lastFrameReceivedMs = performance.now();
    this.lastMediaPipeTimestamp = 0;
    this.lowFpsStreakStartMs = 0;
    this.frameCounter = 0;
    this.fpsSamples = [];
    this.currentFps = this.fpsCap;
    this.startWatchdog();

    const processLoop = () => {
      this.rafId = requestAnimationFrame(processLoop);

      const now = performance.now();
      const video = videoRef.current;
      if (!video || !this.worker || !this.isReady || this.isBusy || this.isSwitching) return;
      if (video.readyState < 2 || video.paused || video.ended) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw <= 0 || vh <= 0) return;

      // Rate limit based strictly on user's configured fpsCap (15, 30, or 60 FPS)
      const targetIntervalMs = 1000 / Math.max(10, this.fpsCap);
      // 3ms tolerance for display vsync tick jitter (e.g. 16.6ms vsync tick at 60 FPS)
      if (now - this.lastSubmittedMs < targetIntervalMs - 3) return;

      // Periodic canvas texture recycling every 500 frames to purge Skia / Direct3D 11 staging textures
      this.frameCounter++;
      if (this.frameCounter % 500 === 0) {
        this.offscreen = null;
        this.offscreenCtx = null;
      }

      // Downsample input frame to max 480px dimension to eliminate GPU texture bandwidth bottlenecks.
      // MediaPipe HandLandmarker internally operates on a 256x256 tensor; normalized landmarks [0..1]
      // are completely resolution-invariant.
      const maxDim = 480;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      const targetW = Math.max(1, Math.round(vw * scale));
      const targetH = Math.max(1, Math.round(vh * scale));

      if (
        !this.offscreen ||
        this.offscreen.width !== targetW ||
        this.offscreen.height !== targetH
      ) {
        this.offscreen = new OffscreenCanvas(targetW, targetH);
        this.offscreenCtx = this.offscreen.getContext("2d", {
          alpha: false,
          desynchronized: true,
        });
      }

      if (!this.offscreenCtx) return;

      this.offscreenCtx.drawImage(video, 0, 0, targetW, targetH);
      const bitmap = this.offscreen.transferToImageBitmap();

      // Ensure strictly monotonically increasing timestamp for MediaPipe VIDEO runningMode
      const timestampMs = Math.max(now, this.lastMediaPipeTimestamp + 1);
      this.lastMediaPipeTimestamp = timestampMs;
      this.lastSubmittedMs = now;
      this.isBusy = true;
      this.worker.postMessage(
        {
          type: "DETECT_FRAME",
          bitmap,
          timestampMs,
          videoWidth: vw,
          videoHeight: vh,
        },
        [bitmap],
      );
    };

    this.rafId = requestAnimationFrame(processLoop);
  }

  detachVideo(clearRef = false) {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isBusy = false;
    this.consecutiveNoHandFrames = 0;
    this.lowFpsStreakStartMs = 0;
    if (clearRef) {
      this.attachedVideoRef = null;
      this.stopWatchdog();
    }
    this.worker?.postMessage({ type: "RESET" });
  }

  stop() {
    this.stopWatchdog();
    this.detachVideo(true);
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.isSwitching = false;
    this.consecutiveNoHandFrames = 0;
    this.lowFpsStreakStartMs = 0;
    this.offscreen = null;
    this.offscreenCtx = null;
  }
}

export const workerClient = new VisionWorkerClient();
