use trace_core::drawing::{catmull_rom_spline, simplify_stroke};
use trace_core::types::{CalibrationProfile, Handedness, StrokePoint};
use trace_core::VisionPipeline;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmVisionPipeline {
    inner: VisionPipeline,
}

#[wasm_bindgen]
impl WasmVisionPipeline {
    #[wasm_bindgen(constructor)]
    pub fn new(profile_js: JsValue) -> Result<WasmVisionPipeline, JsValue> {
        let profile: CalibrationProfile = if profile_js.is_undefined() || profile_js.is_null() {
            CalibrationProfile::default()
        } else {
            serde_wasm_bindgen::from_value(profile_js)
                .map_err(|e| JsValue::from_str(&format!("Invalid calibration profile: {e}")))?
        };
        Ok(Self {
            inner: VisionPipeline::new(profile),
        })
    }

    pub fn update_calibration(&mut self, profile_js: JsValue) -> Result<(), JsValue> {
        let profile: CalibrationProfile = serde_wasm_bindgen::from_value(profile_js)
            .map_err(|e| JsValue::from_str(&format!("Invalid calibration profile: {e}")))?;
        self.inner.update_calibration(profile);
        Ok(())
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }

    /// Processes 21 screen landmarks (63 floats) + optional 21 world landmarks (63 floats).
    /// `handedness_code`: 0 = Unknown, 1 = Left, 2 = Right.
    pub fn process_frame(
        &mut self,
        screen_flat: &[f32],
        world_flat: &[f32],
        handedness_code: u8,
        timestamp_ms: f64,
        confidence: f32,
    ) -> Result<JsValue, JsValue> {
        let handedness = match handedness_code {
            1 => Handedness::Left,
            2 => Handedness::Right,
            _ => Handedness::Unknown,
        };
        let world_opt = if world_flat.len() >= 63 {
            Some(world_flat)
        } else {
            None
        };
        let frame = self.inner.process_frame(
            screen_flat,
            world_opt,
            handedness,
            timestamp_ms,
            confidence,
        );
        serde_wasm_bindgen::to_value(&frame)
            .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))
    }

    pub fn simplify_and_smooth(
        &self,
        points_flat: &[f32],
        epsilon: f32,
        subdivisions: usize,
    ) -> Vec<f32> {
        let mut pts = Vec::with_capacity(points_flat.len() / 2);
        for chunk in points_flat.chunks_exact(2) {
            pts.push(StrokePoint {
                x: chunk[0],
                y: chunk[1],
            });
        }
        let simplified = simplify_stroke(&pts, epsilon);
        let smoothed = catmull_rom_spline(&simplified, subdivisions);
        let mut out = Vec::with_capacity(smoothed.len() * 2);
        for p in smoothed {
            out.push(p.x);
            out.push(p.y);
        }
        out
    }
}

