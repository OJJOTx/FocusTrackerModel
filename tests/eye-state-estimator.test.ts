import { describe, it, expect, beforeEach } from 'vitest';
import { EyeStateEstimator } from '../src/attention/vision/EyeStateEstimator';
import { resolveConfig } from '../src/attention/types/AttentionConfig';
import type { FaceLandmark } from '../src/attention/types/AttentionFeatures';

/**
 * Create 478 landmarks with specific EAR landmark positions to control eye openness.
 *
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 *
 * Left eye indices: [33, 160, 158, 133, 153, 144]
 * Right eye indices: [263, 387, 385, 362, 380, 373]
 *
 * p1=outer(33/263), p2=upper-outer(160/387), p3=upper-inner(158/385),
 * p4=inner(133/362), p5=lower-inner(153/380), p6=lower-outer(144/373)
 */
function createLandmarksWithEAR(targetEAR: number): FaceLandmark[] {
  const landmarks: FaceLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  // Set eye corners to create a known eye width
  // Left eye: outer=33 at x=0.4, inner=133 at x=0.6 (width = 0.2)
  landmarks[33] = { x: 0.4, y: 0.5, z: 0 };  // p1 outer
  landmarks[133] = { x: 0.6, y: 0.5, z: 0 };  // p4 inner

  // Eye height determines EAR
  // EAR = (v1 + v2) / (2 * h) where h = 0.2
  // So v1 + v2 = EAR * 2 * 0.2 = EAR * 0.4
  // Set v1 = v2 = EAR * 0.2
  const halfHeight = targetEAR * 0.2;

  // Upper landmarks above center, lower landmarks below
  landmarks[160] = { x: 0.45, y: 0.5 - halfHeight, z: 0 }; // p2 upper-outer
  landmarks[158] = { x: 0.55, y: 0.5 - halfHeight, z: 0 }; // p3 upper-inner
  landmarks[153] = { x: 0.55, y: 0.5 + halfHeight, z: 0 }; // p5 lower-inner
  landmarks[144] = { x: 0.45, y: 0.5 + halfHeight, z: 0 }; // p6 lower-outer

  // Right eye: same pattern
  landmarks[263] = { x: 0.7, y: 0.5, z: 0 };  // p1 outer
  landmarks[362] = { x: 0.9, y: 0.5, z: 0 };  // p4 inner
  landmarks[387] = { x: 0.75, y: 0.5 - halfHeight, z: 0 }; // p2 upper-outer
  landmarks[385] = { x: 0.85, y: 0.5 - halfHeight, z: 0 }; // p3 upper-inner
  landmarks[380] = { x: 0.85, y: 0.5 + halfHeight, z: 0 }; // p5 lower-inner
  landmarks[373] = { x: 0.75, y: 0.5 + halfHeight, z: 0 }; // p6 lower-outer

  return landmarks;
}

describe('EyeStateEstimator', () => {
  let estimator: EyeStateEstimator;

  beforeEach(() => {
    estimator = new EyeStateEstimator(resolveConfig());
  });

  it('detects eyes as open when EAR is above threshold', () => {
    const landmarks = createLandmarksWithEAR(0.35); // Well above 0.25
    const result = estimator.estimate(landmarks);

    expect(result.leftOpen).toBe(true);
    expect(result.rightOpen).toBe(true);
    expect(result.averageEAR).toBeGreaterThan(0.2);
  });

  it('detects eyes as closed when EAR is below threshold', () => {
    // Need to push past hysteresis — start open, then go closed
    const openLandmarks = createLandmarksWithEAR(0.35);
    estimator.estimate(openLandmarks); // establish open state

    // Now send very low EAR multiple times to push through EMA
    const closedLandmarks = createLandmarksWithEAR(0.08);
    for (let i = 0; i < 5; i++) {
      estimator.estimate(closedLandmarks);
    }

    const result = estimator.estimate(closedLandmarks);
    expect(result.leftOpen).toBe(false);
    expect(result.rightOpen).toBe(false);
  });

  it('uses hysteresis for state transitions', () => {
    // Start with open eyes
    const openLandmarks = createLandmarksWithEAR(0.35);
    estimator.estimate(openLandmarks);
    estimator.estimate(openLandmarks);

    // Go to a value between closed and open thresholds (0.20-0.25)
    // This should NOT transition to closed since we're in the dead zone
    const middleLandmarks = createLandmarksWithEAR(0.22);
    const result = estimator.estimate(middleLandmarks);

    // Still open due to hysteresis (need to go below 0.20 to close)
    expect(result.leftOpen).toBe(true);
  });

  it('reduces confidence when the two eyes disagree strongly', () => {
    const landmarks = createLandmarksWithEAR(0.32);

    // Collapse only the left eye vertically to mimic a partial occlusion /
    // unstable landmark fit while the right eye remains open.
    landmarks[160].y = 0.495;
    landmarks[158].y = 0.495;
    landmarks[153].y = 0.505;
    landmarks[144].y = 0.505;

    const result = estimator.estimate(landmarks);
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('returns zero confidence for empty landmarks', () => {
    const result = estimator.estimate([]);
    expect(result.confidence).toBe(0);
    expect(result.leftOpen).toBe(false);
    expect(result.rightOpen).toBe(false);
  });

  it('resets state correctly', () => {
    // Close eyes
    const closedLandmarks = createLandmarksWithEAR(0.08);
    for (let i = 0; i < 10; i++) {
      estimator.estimate(closedLandmarks);
    }

    // Reset
    estimator.reset();

    // First estimate after reset starts fresh (default wasOpen = true)
    const openLandmarks = createLandmarksWithEAR(0.35);
    const result = estimator.estimate(openLandmarks);
    expect(result.leftOpen).toBe(true);
    expect(result.rightOpen).toBe(true);
  });
});
