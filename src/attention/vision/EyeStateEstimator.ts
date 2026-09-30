/**
 * Eye State Estimator
 *
 * Estimates whether each eye is open or closed using Eye Aspect Ratio (EAR).
 * Adds per-eye geometry confidence so partially occluded eyes do not remain
 * "100% confident" merely because MediaPipe returned landmarks.
 */

import { EyeStateFeatures, FaceLandmark } from '../types/AttentionFeatures';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { EAR_LANDMARKS } from '../utils/constants';
import { distance2D } from '../utils/math';
import { ExponentialMovingAverage } from '../utils/smoothing';

export class EyeStateEstimator {
  private readonly config: ResolvedAttentionConfig;
  private readonly leftEarEMA: ExponentialMovingAverage;
  private readonly rightEarEMA: ExponentialMovingAverage;

  private wasLeftOpen = true;
  private wasRightOpen = true;

  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
    this.leftEarEMA = new ExponentialMovingAverage(0.5);
    this.rightEarEMA = new ExponentialMovingAverage(0.5);
  }

  estimate(landmarks: FaceLandmark[]): EyeStateFeatures {
    if (!landmarks || landmarks.length < 388) {
      return this.emptyResult();
    }

    const rawLeftEAR = this.calculateEAR(landmarks, EAR_LANDMARKS.left);
    const rawRightEAR = this.calculateEAR(landmarks, EAR_LANDMARKS.right);

    const leftEAR = this.leftEarEMA.update(rawLeftEAR);
    const rightEAR = this.rightEarEMA.update(rawRightEAR);
    const averageEAR = (leftEAR + rightEAR) / 2;

    const leftConfidence = this.computeEyeConfidence(leftEAR);
    const rightConfidence = this.computeEyeConfidence(rightEAR);

    // A large inter-eye disagreement is often a sign of partial occlusion,
    // glare, a hand over one eye, or unstable landmarks.
    const earDifference = Math.abs(leftEAR - rightEAR);
    const symmetryPenalty = Math.max(0.15, 1 - earDifference / 0.18);
    const confidence =
      Math.min(leftConfidence, rightConfidence) * symmetryPenalty;

    const closedThreshold = this.config.eyeClosedThreshold;
    const openThreshold = this.config.eyeOpenThreshold;

    let leftOpen = this.wasLeftOpen;
    if (leftConfidence < 0.25) {
      leftOpen = this.wasLeftOpen;
    } else if (this.wasLeftOpen && leftEAR < closedThreshold) {
      leftOpen = false;
    } else if (!this.wasLeftOpen && leftEAR > openThreshold) {
      leftOpen = true;
    }

    let rightOpen = this.wasRightOpen;
    if (rightConfidence < 0.25) {
      rightOpen = this.wasRightOpen;
    } else if (this.wasRightOpen && rightEAR < closedThreshold) {
      rightOpen = false;
    } else if (!this.wasRightOpen && rightEAR > openThreshold) {
      rightOpen = true;
    }

    this.wasLeftOpen = leftOpen;
    this.wasRightOpen = rightOpen;

    return {
      leftEAR,
      rightEAR,
      averageEAR,
      leftOpen,
      rightOpen,
      leftConfidence,
      rightConfidence,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  reset(): void {
    this.leftEarEMA.reset();
    this.rightEarEMA.reset();
    this.wasLeftOpen = true;
    this.wasRightOpen = true;
  }

  private computeEyeConfidence(ear: number): number {
    if (!Number.isFinite(ear) || ear <= 0 || ear > 0.65) return 0.05;

    // Typical webcam EAR values sit roughly in 0.08-0.45.
    if (ear < 0.04 || ear > 0.5) return 0.2;
    if (ear < 0.07 || ear > 0.45) return 0.55;
    return 1;
  }

  private calculateEAR(landmarks: FaceLandmark[], indices: number[]): number {
    if (indices.length !== 6) return 0;

    const p1 = landmarks[indices[0]];
    const p2 = landmarks[indices[1]];
    const p3 = landmarks[indices[2]];
    const p4 = landmarks[indices[3]];
    const p5 = landmarks[indices[4]];
    const p6 = landmarks[indices[5]];

    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0;

    const v1 = distance2D(p2, p6);
    const v2 = distance2D(p3, p5);
    const h = distance2D(p1, p4);

    if (h === 0) return 0;
    return (v1 + v2) / (2 * h);
  }

  private emptyResult(): EyeStateFeatures {
    return {
      leftEAR: 0,
      rightEAR: 0,
      averageEAR: 0,
      leftOpen: false,
      rightOpen: false,
      leftConfidence: 0,
      rightConfidence: 0,
      confidence: 0,
    };
  }
}
