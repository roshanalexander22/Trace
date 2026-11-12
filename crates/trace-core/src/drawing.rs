use crate::types::{StrokeDto, StrokePoint};

#[inline]
fn perpendicular_distance(p: StrokePoint, a: StrokePoint, b: StrokePoint) -> f32 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-10 {
        return ((p.x - a.x).powi(2) + (p.y - a.y).powi(2)).sqrt();
    }
    ((dy * p.x - dx * p.y + b.x * a.y - b.y * a.x).abs()) / len_sq.sqrt()
}

/// Ramer-Douglas-Peucker polyline simplification to keep stored vector strokes compact
/// without sacrificing visual fidelity.
pub fn simplify_stroke(points: &[StrokePoint], epsilon: f32) -> Vec<StrokePoint> {
    if points.len() <= 2 {
        return points.to_vec();
    }

    let first = points[0];
    let last = points[points.len() - 1];
    let mut max_dist = 0.0f32;
    let mut split_idx = 0usize;

    for (i, &pt) in points.iter().enumerate().take(points.len() - 1).skip(1) {
        let d = perpendicular_distance(pt, first, last);
        if d > max_dist {
            max_dist = d;
            split_idx = i;
        }
    }

    if max_dist > epsilon {
        let mut left = simplify_stroke(&points[..=split_idx], epsilon);
        let right = simplify_stroke(&points[split_idx..], epsilon);
        left.pop();
        left.extend(right);
        left
    } else {
        vec![first, last]
    }
}

/// Generates smooth interpolated points along a stroke using centripetal Catmull-Rom splines.
pub fn catmull_rom_spline(points: &[StrokePoint], subdivisions: usize) -> Vec<StrokePoint> {
    if points.len() < 3 || subdivisions == 0 {
        return points.to_vec();
    }

    let mut out = Vec::with_capacity((points.len() - 1) * subdivisions + 1);
    out.push(points[0]);

    for i in 0..(points.len() - 1) {
        let p0 = if i == 0 { points[0] } else { points[i - 1] };
        let p1 = points[i];
        let p2 = points[i + 1];
        let p3 = if i + 2 < points.len() {
            points[i + 2]
        } else {
            points[points.len() - 1]
        };

        for step in 1..=subdivisions {
            let t = step as f32 / subdivisions as f32;
            let t2 = t * t;
            let t3 = t2 * t;

            let x = 0.5
                * ((2.0 * p1.x)
                    + (-p0.x + p2.x) * t
                    + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2
                    + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3);
            let y = 0.5
                * ((2.0 * p1.y)
                    + (-p0.y + p2.y) * t
                    + (2.0 * p0.y - 5.0 * p1.y + 4.0 * p2.y - p3.y) * t2
                    + (-p0.y + 3.0 * p1.y - 3.0 * p2.y + p3.y) * t3);

            out.push(StrokePoint { x, y });
        }
    }
    out
}

/// Converts normalized `[0..1]` vector strokes into a clean standalone SVG document string.
pub fn render_strokes_to_svg(width: u32, height: u32, strokes: &[StrokeDto]) -> String {
    let mut svg = String::with_capacity(1024 + strokes.len() * 128);
    svg.push_str(&format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">"##
    ));
    svg.push_str(&format!(
        r##"<rect width="{width}" height="{height}" fill="#ffffff"/>"##
    ));

    let wf = width as f32;
    let hf = height as f32;

    for stroke in strokes {
        if stroke.points.is_empty() {
            continue;
        }
        let color = if stroke.tool == "eraser" {
            "#ffffff"
        } else {
            stroke.color.as_str()
        };

        if stroke.tool == "spray" {
            let mut seed: u32 = 2166136261;
            for b in stroke.id.bytes() {
                seed ^= u32::from(b);
                seed = seed.wrapping_mul(16777619);
            }
            let radius = (stroke.width * 1.6).max(8.0);
            for pt in &stroke.points {
                for _ in 0..14 {
                    seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                    let r1 = seed as f32 / 4294967296.0;
                    seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                    let r2 = seed as f32 / 4294967296.0;
                    seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
                    let r3 = seed as f32 / 4294967296.0;

                    let angle = r1 * std::f32::consts::TAU;
                    let dist = r2.sqrt() * radius;
                    let dot_r = 0.8 + r3 * 1.4;
                    svg.push_str(&format!(
                        r#"<circle cx="{:.2}" cy="{:.2}" r="{:.2}" fill="{}"/>"#,
                        pt.x * wf + angle.cos() * dist,
                        pt.y * hf + angle.sin() * dist,
                        dot_r,
                        escape_xml_attr(color)
                    ));
                }
            }
            continue;
        }

        let smoothed = if stroke.tool == "line" || stroke.tool == "rect" {
            stroke.points.clone()
        } else {
            catmull_rom_spline(&stroke.points, 3)
        };

        let eff_width = if stroke.tool == "highlighter" {
            stroke.width * 2.0
        } else {
            stroke.width
        };
        let linecap = if stroke.tool == "highlighter" {
            "square"
        } else {
            "round"
        };

        if smoothed.len() == 1 {
            let p = smoothed[0];
            svg.push_str(&format!(
                r#"<circle cx="{:.2}" cy="{:.2}" r="{:.2}" fill="{}"/>"#,
                p.x * wf,
                p.y * hf,
                eff_width * 0.5,
                escape_xml_attr(color)
            ));
            continue;
        }

        let mut d = String::new();
        for (idx, pt) in smoothed.iter().enumerate() {
            let cmd = if idx == 0 { 'M' } else { 'L' };
            d.push_str(&format!("{cmd}{:.2} {:.2} ", pt.x * wf, pt.y * hf));
        }

        svg.push_str(&format!(
            r#"<path d="{}" fill="none" stroke="{}" stroke-width="{:.2}" stroke-linecap="{}" stroke-linejoin="round"/>"#,
            d.trim_end(),
            escape_xml_attr(color),
            eff_width,
            linecap
        ));
    }

    svg.push_str("</svg>");
    svg
}

fn escape_xml_attr(val: &str) -> String {
    val.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

