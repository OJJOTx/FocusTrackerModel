import { describe, it, expect, beforeEach } from 'vitest';
import { GazeEstimator } from '../src/attention/vision/GazeEstimator';
import { resolveConfig } from '../src/attention/types/AttentionConfig';
import { FACE_LANDMARKS } from '../src/attention/utils/constants';
import type { FaceLandmark } from '../src/attention/types/AttentionFeatures';

/**
 * Create 478 landmarks with specific iris positions to control gaze ratios.
 *
 * Horizontal ratio = (iris.x - innerCorner.x) / (outerCorner.x - innerCorner.x)
 * When iris is at center of eye, ratio ≈ 0.5
 */
function createLandmarksWithGaze(hRatio: number, vRatio: number): FaceLandmark[] {
  const landmarks: FaceLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  // Left eye corners (innerCorner=133, outerCorner=33)
  const leftInnerX = 0.45;
  const leftOuterX = 0.35;
  const leftUpperY = 0.48;
  const leftLowerY = 0.52;

  landmarks[FACE_LANDMARKS.leftEyeInnerCorner] = { x: leftInnerX, y: 0.5, z: 0 };
  landmarks[FACE_LANDMARKS.leftEyeOuterCorner] = { x: leftOuterX, y: 0.5, z: 0 };
  landmarks[FACE_LANDMARKS.leftEyeUpper] = { x: 0.4, y: leftUpperY, z: 0 };
  landmarks[FACE_LANDMARKS.leftEyeLower] = { x: 0.4, y: leftLowerY, z: 0 };

  // Left iris at specified ratio
  const leftIrisX = leftInnerX + (leftOuterX - leftInnerX) * hRatio;
  const leftIrisY = leftUpperY + (leftLowerY - leftUpperY) * vRatio;
  landmarks[FACE_LANDMARKS.leftIrisCenter] = { x: leftIrisX, y: leftIrisY, z: 0 };

  // Right eye corners (innerCorner=362, outerCorner=263)
  const rightInnerX = 0.55;
  const rightOuterX = 0.65;
  const rightUpperY = 0.48;
  const rightLowerY = 0.52;

  landmarks[FACE_LANDMARKS.rightEyeInnerCorner] = { x: rightInnerX, y: 0.5, z: 0 };
  landmarks[FACE_LANDMARKS.rightEyeOuterCorner] = { x: rightOuterX, y: 0.5, z: 0 };
  landmarks[FACE_LANDMARKS.rightEyeUpper] = { x: 0.6, y: rightUpperY, z: 0 };
  landmarks[FACE_LANDMARKS.rightEyeLower] = { x: 0.6, y: rightLowerY, z: 0 };

  // Right iris at specified ratio
  const rightIrisX = rightInnerX + (rightOuterX - rightInnerX) * hRatio;
  const rightIrisY = rightUpperY + (rightLowerY - rightUpperY) * vRatio;
  landmarks[FACE_LANDMARKS.rightIrisCenter] = { x: rightIrisX, y: rightIrisY, z: 0 };

  return landmarks;
}

describe('GazeEstimator', () => {
  let estimator: GazeEstimator;

  beforeEach(() => {
    estimator = new GazeEstimator(resolveConfig());
  });

  it('returns center ratio (~0.5) when iris is centered', () => {
    const landmarks = createLandmarksWithGaze(0.5, 0.5);
    const result = estimator.estimate(landmarks);

    expect(result.horizontalRatio).toBeCloseTo(0.5, 1);
    expect(result.verticalRatio).toBeCloseTo(0.5, 1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns high ratio when iris is toward outer corner (looking left)', () => {
    const landmarks = createLandmarksWithGaze(0.8, 0.5);
    const result = estimator.estimate(landmarks);

    expect(result.horizontalRatio).toBeGreaterThan(0.6);
  });

  it('returns low ratio when iris is toward inner corner (looking right)', () => {
    const landmarks = createLandmarksWithGaze(0.2, 0.5);
    const result = estimator.estimate(landmarks);

    expect(result.horizontalRatio).toBeLessThan(0.4);
  });

  it('returns low vertical ratio when looking up', () => {
    const landmarks = createLandmarksWithGaze(0.5, 0.2);
    const result = estimator.estimate(landmarks);

    expect(result.verticalRatio).toBeLessThan(0.4);
  });

  it('returns high vertical ratio when looking down', () => {
    const landmarks = createLandmarksWithGaze(0.5, 0.8);
    const result = estimator.estimate(landmarks);

    expect(result.verticalRatio).toBeGreaterThan(0.6);
  });

  it('returns 0 confidence for empty landmarks', () => {
    const result = estimator.estimate([]);

    expect(result.confidence).toBe(0);
    expect(result.horizontalRatio).toBe(0.5);
  });

  it('applies EMA smoothing (values change gradually)', () => {
    // First: center
    const center = createLandmarksWithGaze(0.5, 0.5);
    const r1 = estimator.estimate(center);

    // Then: far right in one step
    const right = createLandmarksWithGaze(0.1, 0.5);
    const r2 = estimator.estimate(right);

    // The smoothed ratio should be between center and far right
    expect(r2.horizontalRatio).toBeGreaterThan(0.1);
    expect(r2.horizontalRatio).toBeLessThan(r1.horizontalRatio);
  });

  it('resets smoothing state', () => {
    const center = createLandmarksWithGaze(0.5, 0.5);
    estimator.estimate(center);
    estimator.estimate(center);

    estimator.reset();

    // After reset, first value should be returned as-is (no prior smoothing)
    const far = createLandmarksWithGaze(0.9, 0.5);
    const result = estimator.estimate(far);
    expect(result.horizontalRatio).toBeCloseTo(0.9, 1);
  });
});
