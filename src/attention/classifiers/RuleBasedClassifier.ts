/**
 * Rule-Based Attention Classifier
 *
 * V2 classifier using stabilized temporal state, conservative confidence,
 * and state-aware attention scoring.
 */

import { AttentionFeatures, AttentionPrediction, TemporalState } from '../types/AttentionFeatures';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { AttentionClassifier } from './AttentionClassifier';

export class RuleBasedClassifier implements AttentionClassifier {
  private readonly config: ResolvedAttentionConfig;

  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
  }

  classify(features: AttentionFeatures, temporal: TemporalState): AttentionPrediction {
    const scoreComponents = this.computeScoreComponents(features);
    const { state, confidence } = this.determineState(features, temporal);
    const rawScore = this.applyStateConstraints(
      this.computeRawScore(scoreComponents),
      state,
    );

    return {
      state,
      confidence,
      rawScore,
      scoreComponents,
    };
  }

  private computeScoreComponents(features: AttentionFeatures): {
    gazeScore: number;
    headScore: number;
    presenceScore: number;
    eyeScore: number;
  } {
    return {
      gazeScore: this.computeGazeScore(features),
      headScore: this.computeHeadScore(features),
      presenceScore: this.computePresenceScore(features),
      eyeScore: this.computeEyeScore(features),
    };
  }

  private computeGazeScore(features: AttentionFeatures): number {
    if (!features.gaze || features.gaze.confidence < 0.2) return 0;

    const { horizontalRatio, verticalRatio, confidence } = features.gaze;
    const hDeviation = Math.abs(horizontalRatio - 0.5);
    const vDeviation = Math.abs(verticalRatio - 0.5);

    const hScore = Math.max(0, 1 - hDeviation / 0.5);
    const vScore = Math.max(0, 1 - vDeviation / 0.5);
    const combinedScore = hScore * 0.7 + vScore * 0.3;

    return Math.pow(combinedScore, 0.8) * confidence * 100;
  }

  private computeHeadScore(features: AttentionFeatures): number {
    if (!features.headPose || features.headPose.confidence < 0.2) return 0;

    const { yaw, pitch, confidence } = features.headPose;
    const maxYaw = Math.max(1, this.config.facingScreenThreshold * 2);
    const maxPitch = Math.max(1, this.config.facingScreenThreshold * 2);

    const yawScore = Math.max(0, 1 - Math.abs(yaw) / maxYaw);
    const pitchScore = Math.max(0, 1 - Math.abs(pitch) / maxPitch);

    return (yawScore * 0.6 + pitchScore * 0.4) * confidence * 100;
  }

  private computePresenceScore(features: AttentionFeatures): number {
    if (!features.face.detected) return 0;
    return features.face.confidence * 100;
  }

  private computeEyeScore(features: AttentionFeatures): number {
    if (!features.eyeState || features.eyeState.confidence < 0.2) return 0;

    const { averageEAR, confidence } = features.eyeState;
    const minEAR = this.config.eyeClosedThreshold;
    const maxEAR = 0.35;
    const normalized = Math.max(
      0,
      Math.min(1, (averageEAR - minEAR) / Math.max(0.01, maxEAR - minEAR)),
    );

    return normalized * confidence * 100;
  }

  private computeRawScore(components: {
    gazeScore: number;
    headScore: number;
    presenceScore: number;
    eyeScore: number;
  }): number {
    const w = this.config.scoreWeights;
    const score =
      w.gaze * components.gazeScore +
      w.head * components.headScore +
      w.presence * components.presenceScore +
      w.eyes * components.eyeScore;

    return Math.max(0, Math.min(100, score));
  }

  private determineState(
    features: AttentionFeatures,
    temporal: TemporalState,
  ): { state: string; confidence: number } {
    // Effective absence includes the short face-reacquisition hold.
    if (temporal.wasAbsent) {
      if (temporal.absentDurationMs > this.config.absentThresholdMs) {
        return { state: 'absent', confidence: temporal.faceReacquiring ? 70 : 90 };
      }

      if (temporal.absentDurationMs > this.config.absentGraceMs) {
        return { state: 'absent', confidence: 60 };
      }

      return {
        state: temporal.lastState === 'absent' ? 'absent' : 'uncertain',
        confidence: 30,
      };
    }

    if (
      features.eyeState &&
      features.eyeState.confidence >= 0.3 &&
      !features.eyeState.leftOpen &&
      !features.eyeState.rightOpen &&
      temporal.eyesClosedDurationMs > this.config.prolongedEyeClosureMs
    ) {
      return { state: 'eyes_closed', confidence: 85 };
    }

    const overallConfidence = this.computeOverallConfidence(features);
    if (overallConfidence < this.config.minConfidenceThreshold) {
      return { state: 'uncertain', confidence: overallConfidence };
    }

    if (temporal.wasLookingAway) {
      if (temporal.lookingAwayDurationMs > this.config.lookingAwayThresholdMs) {
        switch (temporal.stableDirection) {
          case 'left':
            return { state: 'looking_left', confidence: overallConfidence };
          case 'right':
            return { state: 'looking_right', confidence: overallConfidence };
          case 'up':
            return { state: 'looking_up', confidence: overallConfidence };
          case 'down':
            return { state: 'looking_down', confidence: overallConfidence };
          default:
            return { state: 'looking_away', confidence: overallConfidence * 0.9 };
        }
      }

      if (temporal.lookingAwayDurationMs > this.config.lookingAwayGraceMs) {
        return { state: 'looking_away', confidence: overallConfidence * 0.75 };
      }
    }

    return { state: 'focused', confidence: overallConfidence };
  }

  private computeOverallConfidence(features: AttentionFeatures): number {
    const weights = { face: 0.35, gaze: 0.3, headPose: 0.2, eyeState: 0.15 };

    if (!features.face.detected) return 0;

    let total = weights.face * features.face.confidence * 100;
    let weightSum = weights.face;

    if (features.gaze) {
      total += weights.gaze * features.gaze.confidence * 100;
      weightSum += weights.gaze;
    }

    if (features.headPose) {
      total += weights.headPose * features.headPose.confidence * 100;
      weightSum += weights.headPose;
    }

    if (features.eyeState) {
      total += weights.eyeState * features.eyeState.confidence * 100;
      weightSum += weights.eyeState;
    }

    return weightSum > 0 ? total / weightSum : 0;
  }

  private applyStateConstraints(score: number, state: string): number {
    switch (state) {
      case 'absent':
        return 0;
      case 'eyes_closed':
        return Math.min(score, 25);
      case 'looking_away':
      case 'looking_left':
      case 'looking_right':
      case 'looking_up':
      case 'looking_down':
        return Math.min(score, 55);
      case 'uncertain':
        return Math.min(score, 50);
      default:
        return score;
    }
  }
}
