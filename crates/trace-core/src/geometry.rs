use crate::types::{CalibrationProfile, FingerStates, Point3};

const RAD_TO_DEG: f32 = 180.0 / std::f32::consts::PI;

/// Computes the angle in degrees between two 3D vectors `u` and `v`.
#[inline]
pub fn angle_between_deg(u: Point3, v: Point3) -> f32 {
    let mag = u.norm() * v.norm();
    if mag < 1e-6 {
        return 0.0;
    }
    let cos_theta = (u.dot(v) / mag).clamp(-1.0, 1.0);
    cos_theta.acos() * RAD_TO_DEG
}

/// Converts a flat `[x0, y0, z0, ...]` slice of 63 floats into 21 `Point3` landmarks.
pub fn parse_landmarks(flat: &[f32], mirror_x: bool) -> Option<[Point3; 21]> {
    if flat.len() < 63 {
        return None;
    }
    let mut pts = [Point3::default(); 21];
    for (i, pt) in pts.iter_mut().enumerate() {
        let base = i * 3;
        let x = if mirror_x { 1.0 - flat[base] } else { flat[base] };
        *pt = Point3::new(x, flat[base + 1], flat[base + 2]);
    }
    Some(pts)
}

/// Evaluates whether each of the 5 fingers is extended using scale-invariant 3D joint angles
/// and wrist-distance ratios (works regardless of palm rotation, left/right hand, or mirroring).
pub fn evaluate_finger_states(
    landmarks: &[Point3; 21],
    profile: &CalibrationProfile,
) -> (FingerStates, [f32; 5], bool) {
    let wrist = landmarks[0];
    let index_mcp = landmarks[5];
    let pinky_mcp = landmarks[17];
    let palm_scale = index_mcp.dist(wrist);

    if palm_scale < 0.015 {
        return (FingerStates::default(), [0.0; 5], false);
    }

    // Thumb: IP joint bend angle (2->3 vs 3->4) + cross-palm span (4->17) normalized by palm_scale.
    let thumb_b1 = landmarks[3].sub(landmarks[2]);
    let thumb_b2 = landmarks[4].sub(landmarks[3]);
    let thumb_ip_deg = angle_between_deg(thumb_b1, thumb_b2);
    let thumb_span_ratio = landmarks[4].dist(pinky_mcp) / palm_scale;
    let thumb_index_ratio = landmarks[4].dist(index_mcp) / palm_scale;

    let thumb_extended = thumb_span_ratio > profile.thumb_spread_ratio
        && thumb_index_ratio > 0.38
        && thumb_ip_deg < 44.0;
    let thumb_score = ((thumb_span_ratio - 0.85) / 0.65).clamp(0.0, 1.0);

    let finger_indices: [(usize, usize, usize, usize); 4] = [
        (5, 6, 7, 8),     // Index
        (9, 10, 11, 12),  // Middle
        (13, 14, 15, 16), // Ring
        (17, 18, 19, 20), // Pinky
    ];

    let mut extended = [false; 4];
    let mut angles = [thumb_ip_deg, 0.0, 0.0, 0.0, 0.0];
    let mut scores = [thumb_score, 0.0, 0.0, 0.0, 0.0];

    for (idx, &(mcp, pip, dip, tip)) in finger_indices.iter().enumerate() {
        let b1 = landmarks[pip].sub(landmarks[mcp]);
        let b2 = landmarks[dip].sub(landmarks[pip]);
        let b3 = landmarks[tip].sub(landmarks[dip]);

        let bend_deg = angle_between_deg(b1, b2) + angle_between_deg(b2, b3);
        let tip_wrist = landmarks[tip].dist(wrist);
        let pip_wrist = landmarks[pip].dist(wrist);
        let mcp_wrist = landmarks[mcp].dist(wrist);

        // Primary threshold check + fallback for clearly outstretched fingers (protects relaxed Scissors/Paper)
        let primary_ext = bend_deg < profile.finger_curl_threshold_deg
            && tip_wrist > pip_wrist * 1.01
            && tip_wrist > mcp_wrist * 1.12;
        let outstretched_ext = tip_wrist > pip_wrist * 1.15
            && tip_wrist > mcp_wrist * 1.42
            && bend_deg < (profile.finger_curl_threshold_deg + 20.0).min(95.0);

        let is_ext = primary_ext || outstretched_ext;
        extended[idx] = is_ext;
        angles[idx + 1] = bend_deg;
        scores[idx + 1] = (1.0 - (bend_deg / (profile.finger_curl_threshold_deg * 1.8))).clamp(0.0, 1.0);
    }

    let states = FingerStates {
        thumb: thumb_extended,
        index: extended[0],
        middle: extended[1],
        ring: extended[2],
        pinky: extended[3],
        scores,
    };

    (states, angles, true)
}

