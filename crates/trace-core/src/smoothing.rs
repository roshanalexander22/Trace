use crate::types::Point3;
use std::f32::consts::PI;

#[derive(Debug, Clone, Copy)]
struct LowPassFilter {
    prev: Option<f32>,
}

impl LowPassFilter {
    const fn new() -> Self {
        Self { prev: None }
    }

    fn reset(&mut self) {
        self.prev = None;
    }

    fn filter(&mut self, value: f32, alpha: f32) -> f32 {
        let out = match self.prev {
            None => value,
            Some(p) => alpha * value + (1.0 - alpha) * p,
        };
        self.prev = Some(out);
        out
    }

    fn last(&self) -> Option<f32> {
        self.prev
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OneEuro1D {
    x_filter: LowPassFilter,
    dx_filter: LowPassFilter,
}

impl OneEuro1D {
    pub const fn new() -> Self {
        Self {
            x_filter: LowPassFilter::new(),
            dx_filter: LowPassFilter::new(),
        }
    }

    pub fn reset(&mut self) {
        self.x_filter.reset();
        self.dx_filter.reset();
    }

    #[inline]
    fn smoothing_factor(dt: f32, cutoff: f32) -> f32 {
        let r = 2.0 * PI * cutoff.max(0.01) * dt;
        r / (r + 1.0)
    }

    pub fn filter(&mut self, value: f32, dt: f32, min_cutoff: f32, beta: f32, d_cutoff: f32) -> f32 {
        let dt = dt.max(1e-4);
        let dx = match self.x_filter.last() {
            Some(prev) => (value - prev) / dt,
            None => 0.0,
        };
        let a_d = Self::smoothing_factor(dt, d_cutoff);
        let edx = self.dx_filter.filter(dx, a_d);
        let cutoff = min_cutoff + beta * edx.abs();
        let a = Self::smoothing_factor(dt, cutoff);
        self.x_filter.filter(value, a)
    }
}

#[derive(Debug, Clone)]
pub struct HandSmoother {
    filters: [[OneEuro1D; 3]; 21],
    last_timestamp_ms: Option<f64>,
}

impl Default for HandSmoother {
    fn default() -> Self {
        Self::new()
    }
}

impl HandSmoother {
    pub fn new() -> Self {
        Self {
            filters: [[OneEuro1D::new(); 3]; 21],
            last_timestamp_ms: None,
        }
    }

    pub fn reset(&mut self) {
        for lm in &mut self.filters {
            for axis in lm {
                axis.reset();
            }
        }
        self.last_timestamp_ms = None;
    }

    /// Smooths all 21 landmarks using the adaptive 1-Euro filter.
    /// Automatically resets if `timestamp_ms` jumps by > 180 ms (prevents teleporting lines).
    pub fn smooth_landmarks(
        &mut self,
        raw: &[Point3; 21],
        timestamp_ms: f64,
        min_cutoff: f32,
        beta: f32,
        d_cutoff: f32,
    ) -> [Point3; 21] {
        let dt = match self.last_timestamp_ms {
            Some(prev) => {
                let delta_s = ((timestamp_ms - prev) / 1000.0) as f32;
                if delta_s > 0.18 || delta_s <= 0.0 {
                    self.reset();
                    1.0 / 30.0
                } else {
                    delta_s
                }
            }
            None => 1.0 / 30.0,
        };
        self.last_timestamp_ms = Some(timestamp_ms);

        let mut out = [Point3::default(); 21];
        for (i, pt) in raw.iter().enumerate() {
            out[i] = Point3::new(
                self.filters[i][0].filter(pt.x, dt, min_cutoff, beta, d_cutoff),
                self.filters[i][1].filter(pt.y, dt, min_cutoff, beta, d_cutoff),
                self.filters[i][2].filter(pt.z, dt, min_cutoff, beta, d_cutoff),
            );
        }
        out
    }
}

