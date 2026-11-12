import { HandLandmarker } from "@mediapipe/tasks-vision";
import initWasm, { WasmVisionPipeline } from "../wasm/trace_wasm.js";
import type { CalibrationProfile, ProcessedHandFrame } from "../platform/types";

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
let pipeline: WasmVisionPipeline | null = null;
let activeDelegate: "GPU" | "CPU" = "GPU";
let wasmReady = false;
let currentCalibration: CalibrationProfile | null = null;
let lockedHandedness: "Left" | "Right" | null = null;

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
  if (!pipeline) {
    pipeline = new WasmVisionPipeline(calibration);
  } else {
    pipeline.update_calibration(calibration);
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
    pipeline?.update_calibration(msg.calibration);
    if (prevDelegate && prevDelegate !== msg.calibration.delegate) {
      await initialize(msg.calibration);
    }
    return;
  }

  if (msg.type === "RESET") {
    pipeline?.reset();
    lockedHandedness = null;
    return;
  }

  if (msg.type === "DETECT_FRAME") {
    const { bitmap, timestampMs, videoWidth, videoHeight } = msg;
    const t0 = performance.now();
    try {
      if (!handLandmarker || !pipeline) {
        return;
      }

      const result = handLandmarker.detectForVideo(bitmap, timestampMs);
      const count = result.landmarks?.length ?? 0;

      if (count === 0) {
        lockedHandedness = null;
        pipeline.reset();
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
          inferenceMs: performance.now() - t0,
          activeDelegate,
          videoWidth,
          videoHeight,
          timestampMs,
        });
        return;
      }

      // Stick to the previously locked hand when multiple hands appear
      let selectedIndex = 0;
      if (count > 1 && lockedHandedness && result.handedness) {
        const matchIdx = result.handedness.findIndex(
          (h) => h?.[0]?.categoryName === lockedHandedness,
        );
        if (matchIdx >= 0) selectedIndex = matchIdx;
      }

      const handInfo = result.handedness?.[selectedIndex]?.[0];
      const handedStr = handInfo?.categoryName;
      const confidence = handInfo?.score ?? 0.9;
      let handedCode = 0;
      if (handedStr === "Left") {
        handedCode = 1;
        lockedHandedness = "Left";
      } else if (handedStr === "Right") {
        handedCode = 2;
        lockedHandedness = "Right";
      }

      const screenFlat = flattenLandmarks(result.landmarks[selectedIndex]);
      const worldPts = result.worldLandmarks?.[selectedIndex];
      const worldFlat = worldPts ? flattenLandmarks(worldPts) : new Float32Array(0);

      const frame = pipeline.process_frame(
        screenFlat,
        worldFlat,
        handedCode,
        timestampMs,
        confidence,
      ) as ProcessedHandFrame;

      self.postMessage({
        type: "FRAME_RESULT",
        frame,
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

