import { useEffect, type RefObject } from "react";
import { workerClient } from "../vision/workerClient";
import { visionBus } from "../vision/visionBus";
import { useAppStore } from "../store/useAppStore";

export function useHandTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  streamActive: boolean,
  trackingEnabled: boolean,
) {
  const calibration = useAppStore((s) => s.calibration);
  const setVisionReady = useAppStore((s) => s.setVisionReady);
  const setVisionError = useAppStore((s) => s.setVisionError);
  const setLiveTelemetry = useAppStore((s) => s.setLiveTelemetry);

  useEffect(() => {
    workerClient.start(calibration, {
      onReady: (delegate) => {
        setVisionReady(true, delegate);
      },
      onError: (msg) => {
        setVisionError(msg);
      },
    });

    let lastUiSync = 0;
    const unsub = visionBus.subscribe((ev) => {
      const now = performance.now();
      if (now - lastUiSync > 120) {
        lastUiSync = now;
        setLiveTelemetry({
          fps: ev.metrics.fps,
          inferenceMs: ev.metrics.inferenceMs,
          activeDelegate: ev.metrics.activeDelegate,
          rendererName: ev.metrics.rendererName,
          detected: ev.frame.detected,
          stableGesture: ev.frame.stable_gesture,
          drawingState: ev.frame.drawing_state,
          confidence: ev.frame.confidence,
          lowLightWarning: ev.frame.low_light_warning,
          fingerBitmask: [
            ev.frame.finger_states.thumb,
            ev.frame.finger_states.index,
            ev.frame.finger_states.middle,
            ev.frame.finger_states.ring,
            ev.frame.finger_states.pinky,
          ],
          fingerAnglesDeg: ev.frame.finger_angles_deg,
        });
      }
    });

    return () => {
      unsub();
      workerClient.stop();
    };
    // Initialize worker once; calibration updates go via updateCalibration below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    workerClient.updateCalibration(calibration);
  }, [calibration]);

  useEffect(() => {
    if (streamActive && trackingEnabled) {
      workerClient.attachVideo(videoRef);
    } else {
      workerClient.detachVideo();
    }
    return () => {
      workerClient.detachVideo();
    };
  }, [videoRef, streamActive, trackingEnabled]);
}

