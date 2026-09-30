/**
 * Gaze Estimator
 *
 * Estimates gaze direction based on geometric iris analysis.
 * Uses iris center position relative to eye corners to determine
 * where the user is looking.
 *
 * Horizontal ratio: (iris.x - innerCorner.x) / (outerCorner.x - innerCorner.x)
 *   ~0.5 = center, >0.6 = looking toward outer (left for left eye), <0.4 = looking toward inner
 *
 * Vertical ratio: (iris.y - upperLid.y) / (lowerLid.y - upperLid.y)
 *   ~0.5 = center, <0.35 = looking up, >0.65 = looking down
 */

import { GazeFeatures, FaceLandmark, CalibrationData } from '../types/AttentionFeatures';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { ExponentialMovingAverage } from '../utils/smoothing';
import { FACE_LANDMARKS } from '../utils/constants';

export class GazeEstimator {
  private readonly horizontalEMA: ExponentialMovingAverage;
  private readonly verticalEMA: ExponentialMovingAverage;
  private calibrationData: CalibrationData | null = null;

  constructor(_config: ResolvedAttentionConfig) {
    // Use a moderate smoothing factor for gaze (less smoothing = more responsive)
    this.horizontalEMA = new ExponentialMovingAverage(0.5);
    this.verticalEMA = new ExponentialMovingAverage(0.5);
  }

  /**
   * Estimate gaze features from face landmarks.
   *
   * @param landmarks - 478 MediaPipe face landmarks (normalized 0-1)
   * @returns Gaze features with iris ratios and confidence
   */
  estimate(landmarks: FaceLandmark[]): GazeFeatures {
    if (!landmarks || landmarks.length < 478) {
      return this.emptyResult();
    }

    // Left eye landmarks
    const leftIris = landmarks[FACE_LANDMARKS.leftIrisCenter];
    const leftInner = landmarks[FACE_LANDMARKS.leftEyeInnerCorner];
    const leftOuter = landmarks[FACE_LANDMARKS.leftEyeOuterCorner];
    const leftUpper = landmarks[FACE_LANDMARKS.leftEyeUpper];
    const leftLower = landmarks[FACE_LANDMARKS.leftEyeLower];

    // Right eye landmarks
    const rightIris = landmarks[FACE_LANDMARKS.rightIrisCenter];
    const rightInner = landmarks[FACE_LANDMARKS.rightEyeInnerCorner];
    const rightOuter = landmarks[FACE_LANDMARKS.rightEyeOuterCorner];
    const rightUpper = landmarks[FACE_LANDMARKS.rightEyeUpper];
    const rightLower = landmarks[FACE_LANDMARKS.rightEyeLower];

    // Validate all landmarks exist
    if (
      !leftIris || !leftInner || !leftOuter || !leftUpper || !leftLower ||
      !rightIris || !rightInner || !rightOuter || !rightUpper || !rightLower
    ) {
      return this.emptyResult();
    }

    // Compute horizontal ratios
    let horizontalRatioLeft = 0.5;
    let horizontalRatioRight = 0.5;

    const leftEyeWidth = leftOuter.x - leftInner.x;
    if (Math.abs(leftEyeWidth) > 0.001) {
      horizontalRatioLeft = (leftIris.x - leftInner.x) / leftEyeWidth;
    }

    const rightEyeWidth = rightOuter.x - rightInner.x;
    if (Math.abs(rightEyeWidth) > 0.001) {
      horizontalRatioRight = (rightIris.x - rightInner.x) / rightEyeWidth;
    }

    // Compute vertical ratios
    let verticalRatioLeft = 0.5;
    let verticalRatioRight = 0.5;

    const leftEyeHeight = leftLower.y - leftUpper.y;
    if (Math.abs(leftEyeHeight) > 0.001) {
      verticalRatioLeft = (leftIris.y - leftUpper.y) / leftEyeHeight;
    }

    const rightEyeHeight = rightLower.y - rightUpper.y;
    if (Math.abs(rightEyeHeight) > 0.001) {
      verticalRatioRight = (rightIris.y - rightUpper.y) / rightEyeHeight;
    }

    // Average both eyes
    let avgHorizontal = (horizontalRatioLeft + horizontalRatioRight) / 2.0;
    let avgVertical = (verticalRatioLeft + verticalRatioRight) / 2.0;

    // Apply calibration offset if available
    if (this.calibrationData?.isCalibrated && this.calibrationData.center) {
      const hOffset = 0.5 - this.calibrationData.center.horizontal;
      const vOffset = 0.5 - this.calibrationData.center.vertical;
      avgHorizontal += hOffset;
      avgVertical += vOffset;
    }

    // Apply EMA smoothing
    const horizontalRatio = this.horizontalEMA.update(avgHorizontal);
    const verticalRatio = this.verticalEMA.update(avgVertical);

    // Confidence: drops when eyes appear closed (upper lid below lower lid)
    let confidence = 1.0;
    if (leftUpper.y >= leftLower.y || rightUpper.y >= rightLower.y) {
      confidence = 0.1; // Eyes likely closed — gaze is unreliable
    }

    return {
      horizontalRatioLeft,
      horizontalRatioRight,
      verticalRatioLeft,
      verticalRatioRight,
      horizontalRatio,
      verticalRatio,
      confidence,
    };
  }

  /**
   * Apply calibration data to adjust gaze estimation.
   */
  applyCalibration(data: CalibrationData): void {
    this.calibrationData = data;
  }

  /**
   * Reset smoothing state.
   */
  reset(): void {
    this.horizontalEMA.reset();
    this.verticalEMA.reset();
  }

  private emptyResult(): GazeFeatures {
    return {
      horizontalRatioLeft: 0.5,
      horizontalRatioRight: 0.5,
      verticalRatioLeft: 0.5,
      verticalRatioRight: 0.5,
      horizontalRatio: 0.5,
      verticalRatio: 0.5,
      confidence: 0,
    };
  }
}
