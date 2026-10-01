/**
 * Gaze Estimator
 *
 * Estimates directional gaze from MediaPipe iris landmarks.
 * Horizontal ratios from the two eyes are canonicalized to the same image-space
 * direction before averaging. Optional 5-point calibration maps each user's
 * natural extrema into a normalized coordinate system.
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
    this.horizontalEMA = new ExponentialMovingAverage(0.5);
    this.verticalEMA = new ExponentialMovingAverage(0.5);
  }

  estimate(landmarks: FaceLandmark[]): GazeFeatures {
    if (!landmarks || landmarks.length < 478) {
      return this.emptyResult();
    }

    const leftIris = landmarks[FACE_LANDMARKS.leftIrisCenter];
    const leftInner = landmarks[FACE_LANDMARKS.leftEyeInnerCorner];
    const leftOuter = landmarks[FACE_LANDMARKS.leftEyeOuterCorner];
    const leftUpper = landmarks[FACE_LANDMARKS.leftEyeUpper];
    const leftLower = landmarks[FACE_LANDMARKS.leftEyeLower];

    const rightIris = landmarks[FACE_LANDMARKS.rightIrisCenter];
    const rightInner = landmarks[FACE_LANDMARKS.rightEyeInnerCorner];
    const rightOuter = landmarks[FACE_LANDMARKS.rightEyeOuterCorner];
    const rightUpper = landmarks[FACE_LANDMARKS.rightEyeUpper];
    const rightLower = landmarks[FACE_LANDMARKS.rightEyeLower];

    if (
      !leftIris || !leftInner || !leftOuter || !leftUpper || !leftLower ||
      !rightIris || !rightInner || !rightOuter || !rightUpper || !rightLower
    ) {
      return this.emptyResult();
    }

    const leftEyeWidth = leftOuter.x - leftInner.x;
    const rightEyeWidth = rightOuter.x - rightInner.x;
    const leftEyeHeight = leftLower.y - leftUpper.y;
    const rightEyeHeight = rightLower.y - rightUpper.y;

    if (
      Math.abs(leftEyeWidth) < 0.001 ||
      Math.abs(rightEyeWidth) < 0.001 ||
      Math.abs(leftEyeHeight) < 0.001 ||
      Math.abs(rightEyeHeight) < 0.001
    ) {
      return this.emptyResult();
    }

    const horizontalRatioLeft = (leftIris.x - leftInner.x) / leftEyeWidth;
    const horizontalRatioRight = (rightIris.x - rightInner.x) / rightEyeWidth;
    const verticalRatioLeft = (leftIris.y - leftUpper.y) / leftEyeHeight;
    const verticalRatioRight = (rightIris.y - rightUpper.y) / rightEyeHeight;

    // The two eyes have opposite inner->outer X axes. Canonicalize right eye
    // before combining so physical gaze does not cancel itself out.
    const canonicalLeft = horizontalRatioLeft;
    const canonicalRight = 1 - horizontalRatioRight;

    let avgHorizontal = (canonicalLeft + canonicalRight) / 2;
    let avgVertical = (verticalRatioLeft + verticalRatioRight) / 2;

    // Confidence falls when the two eyes disagree strongly, ratios are implausible,
    // or eye geometry is too compressed to trust.
    const horizontalDisagreement = Math.abs(canonicalLeft - canonicalRight);
    const verticalDisagreement = Math.abs(verticalRatioLeft - verticalRatioRight);
    const plausibility = [
      horizontalRatioLeft,
      horizontalRatioRight,
      verticalRatioLeft,
      verticalRatioRight,
    ].every((v) => Number.isFinite(v) && v > -0.25 && v < 1.25);

    let confidence = plausibility ? 1 : 0.15;
    confidence *= Math.max(0.1, 1 - horizontalDisagreement / 0.35);
    confidence *= Math.max(0.1, 1 - verticalDisagreement / 0.45);

    // Very narrow visible eye aperture makes iris direction unreliable.
    const leftAperture = Math.abs(leftEyeHeight / leftEyeWidth);
    const rightAperture = Math.abs(rightEyeHeight / rightEyeWidth);
    if (leftAperture < 0.12 || rightAperture < 0.12) {
      confidence *= 0.25;
    }

    if (this.calibrationData?.isCalibrated && this.calibrationData.center) {
      avgHorizontal = this.applyHorizontalCalibration(avgHorizontal, this.calibrationData);
      avgVertical = this.applyVerticalCalibration(avgVertical, this.calibrationData);
    }

    const horizontalRatio = this.horizontalEMA.update(avgHorizontal);
    const verticalRatio = this.verticalEMA.update(avgVertical);

    return {
      horizontalRatioLeft,
      horizontalRatioRight,
      verticalRatioLeft,
      verticalRatioRight,
      horizontalRatio,
      verticalRatio,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  applyCalibration(data: CalibrationData): void {
    this.calibrationData = data;
    this.horizontalEMA.reset();
    this.verticalEMA.reset();
  }

  clearCalibration(): void {
    this.calibrationData = null;
    this.horizontalEMA.reset();
    this.verticalEMA.reset();
  }

  reset(): void {
    this.horizontalEMA.reset();
    this.verticalEMA.reset();
  }

  private applyHorizontalCalibration(value: number, data: CalibrationData): number {
    const center = data.center?.horizontal;
    if (center == null) return value;

    const left = data.left?.horizontal;
    const right = data.right?.horizontal;

    if (value >= center && left != null && Math.abs(left - center) > 0.02) {
      return this.clamp(0.5 + ((value - center) / (left - center)) * 0.25, 0, 1);
    }

    if (value < center && right != null && Math.abs(center - right) > 0.02) {
      return this.clamp(0.5 - ((center - value) / (center - right)) * 0.25, 0, 1);
    }

    return this.clamp(value + (0.5 - center), 0, 1);
  }

  private applyVerticalCalibration(value: number, data: CalibrationData): number {
    const center = data.center?.vertical;
    if (center == null) return value;

    const up = data.up?.vertical;
    const down = data.down?.vertical;

    if (value < center && up != null && Math.abs(center - up) > 0.02) {
      return this.clamp(0.5 - ((center - value) / (center - up)) * 0.25, 0, 1);
    }

    if (value >= center && down != null && Math.abs(down - center) > 0.02) {
      return this.clamp(0.5 + ((value - center) / (down - center)) * 0.25, 0, 1);
    }

    return this.clamp(value + (0.5 - center), 0, 1);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
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
