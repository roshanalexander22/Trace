import { HandLandmarker } from "@mediapipe/tasks-vision";
import initWasm, { WasmVisionPipeline } from "../wasm/trace_wasm.js";
import type { CalibrationProfile, ProcessedHandFrame } from "../platform/types";
import {
  assignHandSlots,
  createHandTrackerMemory,
  type HandSlot,
} from "./handTrackerAssigner";
import type { DetectedHandSummary } from "./visionBus";

type WorkerInMessage =
  | { type: "INIT"; calibration: CalibrationProfile }
  | { type: "UPDATE_CALIBRATION"; calibration: CalibrationProfile }
  | { type: "RESET" }
  | {
      type: "DETECT_FRAME";
      bitmap: ImageBitmap;
      timestampMs: number;
      videoWidth: number;
      videoHeight: number;
    };

let handLandmarker: HandLandmarker | null = null;
let slotPipelines: Record<HandSlot, WasmVisionPipeline | null> = {
  Left: null,
  Right: null,
};
let slotMemory = createHandTrackerMemory();
let lockedPrimarySlot: HandSlot | null = null;
let activeDelegate: "GPU" | "CPU" = "GPU";
let wasmReady = false;
let currentCalibration: CalibrationProfile | null = null;

async function loadLocalVisionFileset() {
  const loaderUrl = new URL("/wasm/vision_wasm_module_internal.js", self.location.origin).href;
  const wasmBinaryUrl = new URL("/wasm/vision_wasm_module_internal.wasm", self.location.origin).href;

  const res = await fetch(loaderUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch MediaPipe WASM loader (${res.status})`);
  }

  const code = await res.text();
  const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    (self as unknown as { ModuleFactory?: unknown }).ModuleFactory = mod.default ?? mod;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  return {
    wasmLoaderPath: "",
    wasmBinaryPath: wasmBinaryUrl,
  };
}

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<HandLandmarker> {
  const vision = await loadLocalVisionFileset();
  const modelUrl = new URL("/models/hand_landmarker.task", self.location.origin).href;
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelUrl,
      delegate,
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

async function initialize(calibration: CalibrationProfile) {
  currentCalibration = calibration;
  if (!wasmReady) {
    await initWasm();
    wasmReady = true;
  }
  if (!slotPipelines.Left) {
    slotPipelines.Left = new WasmVisionPipeline(calibration);
  } else {
    slotPipelines.Left.update_calibration(calibration);
  }
  if (!slotPipelines.Right) {
    slotPipelines.Right = new WasmVisionPipeline(calibration);
  } else {
    slotPipelines.Right.update_calibration(calibration);
  }

  const preferred = calibration.delegate === "CPU" ? "CPU" : "GPU";
  try {
    handLandmarker?.close();
    handLandmarker = await createLandmarker(preferred);
    activeDelegate = preferred;
  } catch (err) {
    if (preferred === "GPU") {
      console.warn("GPU delegate unavailable in worker, falling back to CPU:", err);
      handLandmarker = await createLandmarker("CPU");
      activeDelegate = "CPU";
    } else {
      throw err;
    }
  }

  self.postMessage({ type: "READY", activeDelegate });
}

function flattenLandmarks(pts: Array<{ x: number; y: number; z: number }>): Float32Array {
  const arr = new Float32Array(pts.length * 3);
  for (let i = 0; i < pts.length; i++) {
    arr[i * 3] = pts[i].x;
    arr[i * 3 + 1] = pts[i].y;
    arr[i * 3 + 2] = pts[i].z;
  }
  return arr;
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "INIT") {
    try {
      await initialize(msg.calibration);
    } catch (err) {
      self.postMessage({
        type: "ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === "UPDATE_CALIBRATION") {
    const prevDelegate = currentCalibration?.delegate;
    currentCalibration = msg.calibration;
    slotPipelines.Left?.update_calibration(msg.calibration);
    slotPipelines.Right?.update_calibration(msg.calibration);
    if (prevDelegate && prevDelegate !== msg.calibration.delegate) {
      await initialize(msg.calibration);
    }
    return;
  }

  if (msg.type === "RESET") {
    slotPipelines.Left?.reset();
    slotPipelines.Right?.reset();
    slotMemory = createHandTrackerMemory();
    lockedPrimarySlot = null;
    return;
  }

  if (msg.type === "DETECT_FRAME") {
    const { bitmap, timestampMs, videoWidth, videoHeight } = msg;
    const t0 = performance.now();
    try {
      const leftPipe = slotPipelines.Left;
      const rightPipe = slotPipelines.Right;
      if (!handLandmarker || !leftPipe || !rightPipe) {
        return;
      }

      const result = handLandmarker.detectForVideo(bitmap, timestampMs);
      const count = result.landmarks?.length ?? 0;

      if (count === 0) {
        lockedPrimarySlot = null;
        slotMemory = createHandTrackerMemory();
        leftPipe.reset();
        rightPipe.reset();
        const emptyFrame: ProcessedHandFrame = {
          detected: false,
          handedness: "Unknown",
          landmarks: [],
          cursor: null,
          finger_states: {
            thumb: false,
            index: false,
            middle: false,
            ring: false,
            pinky: false,
            scores: [0, 0, 0, 0, 0],
          },
          raw_gesture: "None",
          stable_gesture: "None",
          drawing_state: "Idle",
          confidence: 0,
          low_light_warning: false,
          finger_angles_deg: [0, 0, 0, 0, 0],
        };
        self.postMessage({
          type: "FRAME_RESULT",
          frame: emptyFrame,
          hands: [],
          inferenceMs: performance.now() - t0,
          activeDelegate,
          videoWidth,
          videoHeight,
          timestampMs,
        });
        return;
      }

      const mirror = currentCalibration?.mirror_feed ?? true;
      const observations = result.landmarks.map((pts, idx) => {
        const hLabel = result.handedness?.[idx]?.[0]?.categoryName;
        const hNorm: "Left" | "Right" | "Unknown" =
          hLabel === "Left" || hLabel === "Right" ? hLabel : "Unknown";
        const wristRaw = pts[0] ?? { x: 0.5, y: 0.5, z: 0 };
        return {
          index: idx,
          wristX: mirror ? 1 - wristRaw.x : wristRaw.x,
          wristY: wristRaw.y,
          handedness: hNorm,
        };
      });

      const assignments = assignHandSlots(observations, slotMemory, timestampMs);
      if (!slotMemory.Left) leftPipe.reset();
      if (!slotMemory.Right) rightPipe.reset();

      const processedBySlot: Partial<Record<HandSlot, ProcessedHandFrame>> = {};
      const hands: DetectedHandSummary[] = [];

      for (const { slot, observationIndex } of assignments) {
        const rawPts = result.landmarks[observationIndex];
        const worldPts = result.worldLandmarks?.[observationIndex];
        const screenFlat = flattenLandmarks(rawPts);
        const worldFlat = worldPts ? flattenLandmarks(worldPts) : new Float32Array(0);
        const confidence = result.handedness?.[observationIndex]?.[0]?.score ?? 0.9;
        const handedCode = slot === "Left" ? 1 : 2;

        const targetPipe = slot === "Left" ? leftPipe : rightPipe;
        const processed = targetPipe.process_frame(
          screenFlat,
          worldFlat,
          handedCode,
          timestampMs,
          confidence,
        ) as ProcessedHandFrame;

        processedBySlot[slot] = processed;
        const fs = processed.finger_states;
        const fingerCount = [fs.thumb, fs.index, fs.middle, fs.ring, fs.pinky].filter(Boolean).length;
        const wrist = processed.landmarks[0] ?? {
          x: observations[observationIndex].wristX,
          y: observations[observationIndex].wristY,
          z: 0,
        };

        hands.push({
          slot,
          handedness: slot,
          fingerCount,
          wristX: wrist.x,
          wristY: wrist.y,
          stableGesture: processed.stable_gesture,
          landmarks: processed.landmarks,
        });
      }

      if (!lockedPrimarySlot || !processedBySlot[lockedPrimarySlot]) {
        lockedPrimarySlot = assignments[0]?.slot ?? "Left";
      }
      const primaryFrame =
        processedBySlot[lockedPrimarySlot] ??
        processedBySlot.Left ??
        processedBySlot.Right!;

      self.postMessage({
        type: "FRAME_RESULT",
        frame: primaryFrame,
        hands,
        inferenceMs: performance.now() - t0,
        activeDelegate,
        videoWidth,
        videoHeight,
        timestampMs,
      });
    } catch (err) {
      console.error("Vision worker frame error:", err);
    } finally {
      // Mandatory to prevent GPU/CPU ImageBitmap memory leaks
      bitmap.close();
    }
  }
};

