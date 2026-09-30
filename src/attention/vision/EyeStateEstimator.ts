/**
 * Eye State Estimator
 *
 * Estimates whether each eye is open or closed using the Eye Aspect Ratio (EAR).
 *
 * EAR formula: (||p2-p6|| + ||p3-p5||) / (2.0 * ||p1-p4||)
 * where p1-p6 are the 6 eye boundary landmarks.
 *
 * Uses hysteresis to avoid flickering between open and closed states:
 * - Transition to closed when EAR drops below eyeClosedThreshold
 * - Transition to open when EAR rises above eyeOpenThreshold
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
    // Moderate smoothing for EAR
    this.leftEarEMA = new ExponentialMovingAverage(0.5);
    this.rightEarEMA = new ExponentialMovingAverage(0.5);
  }

  /**
   * Estimate eye state from face landmarks.
   *
   * @param landmarks - 478 MediaPipe face landmarks (normalized 0-1)
   * @returns Eye state features with EAR values and open/closed classification
   */
  estimate(landmarks: FaceLandmark[]): EyeStateFeatures {
    if (!landmarks || landmarks.length < 388) {
      return {
        leftEAR: 0,
        rightEAR: 0,
        averageEAR: 0,
        leftOpen: false,
        rightOpen: false,
        confidence: 0,
      };
    }

    // Calculate raw EAR for each eye
    const rawLeftEAR = this.calculateEAR(landmarks, EAR_LANDMARKS.left);
    const rawRightEAR = this.calculateEAR(landmarks, EAR_LANDMARKS.right);

    // Apply EMA smoothing
    const leftEAR = this.leftEarEMA.update(rawLeftEAR);
    const rightEAR = this.rightEarEMA.update(rawRightEAR);
    const averageEAR = (leftEAR + rightEAR) / 2.0;

    // Hysteresis-based open/closed detection
    const closedThreshold = this.config.eyeClosedThreshold;
    const openThreshold = this.config.eyeOpenThreshold;

    let leftOpen = this.wasLeftOpen;
    if (this.wasLeftOpen && leftEAR < closedThreshold) {
      leftOpen = false;
    } else if (!this.wasLeftOpen && leftEAR > openThreshold) {
      leftOpen = true;
    }

    let rightOpen = this.wasRightOpen;
    if (this.wasRightOpen && rightEAR < closedThreshold) {
      rightOpen = false;
    } else if (!this.wasRightOpen && rightEAR > openThreshold) {
      rightOpen = true;
    }

    // Update state history
    this.wasLeftOpen = leftOpen;
    this.wasRightOpen = rightOpen;

    return {
      leftEAR,
      rightEAR,
      averageEAR,
      leftOpen,
      rightOpen,
      confidence: 1.0,
    };
  }

  /**
   * Reset smoothing and state tracking.
   */
  reset(): void {
    this.leftEarEMA.reset();
    this.rightEarEMA.reset();
    this.wasLeftOpen = true;
    this.wasRightOpen = true;
  }

  /**
   * Calculate Eye Aspect Ratio from 6 landmark points.
   *
   * p1=outer corner, p2=upper-outer, p3=upper-inner,
   * p4=inner corner, p5=lower-inner, p6=lower-outer
   *
   * EAR = (||p2-p6|| + ||p3-p5||) / (2.0 * ||p1-p4||)
   */
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

    return (v1 + v2) / (2.0 * h);
  }
}
