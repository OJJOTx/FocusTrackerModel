/**
 * Rule-Based Attention Classifier
 *
 * V1 classifier that uses configurable thresholds and weighted scoring
 * to determine attention state from extracted visual features.
 *
 * Decision priority (highest to lowest):
 * 1. Absent (no face detected for > threshold)
 * 2. Eyes closed (prolonged eye closure)
 * 3. Looking away / directional (gaze + head pose combined)
 * 4. Focused (all signals indicate attention)
 * 5. Uncertain (low confidence or ambiguous signals)
 *
 * The attention score formula:
 *   score = w_gaze * gazeScore + w_head * headScore + w_presence * presenceScore + w_eyes * eyeScore
 *
 * All weights and thresholds are configurable via ResolvedAttentionConfig.
 */

import { AttentionFeatures, AttentionPrediction, TemporalState } from '../types/AttentionFeatures';
import { GazeDirection } from '../types/AttentionResult';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { AttentionClassifier } from './AttentionClassifier';

export class RuleBasedClassifier implements AttentionClassifier {
  private readonly config: ResolvedAttentionConfig;

  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
  }

  classify(features: AttentionFeatures, temporal: TemporalState): AttentionPrediction {
    const scoreComponents = this.computeScoreComponents(features);
    const rawScore = this.computeRawScore(scoreComponents);

    // Decision chain (priority order)
    const { state, confidence } = this.determineState(features, temporal, scoreComponents);

    return {
      state,
      confidence,
      rawScore,
      scoreComponents,
    };
  }

  /**
   * Compute individual score components (0-100 each).
   */
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

  /**
   * Gaze score: how centered is the gaze?
   * 100 = looking at center, 0 = looking far away or unknown
   */
  private computeGazeScore(features: AttentionFeatures): number {
    if (!features.gaze) return 0;

    const { horizontalRatio, verticalRatio, confidence } = features.gaze;


    // Compute deviation from center (0.5)
    const hCenter = 0.5;
    const vCenter = 0.5;
    const hDeviation = Math.abs(horizontalRatio - hCenter);
    const vDeviation = Math.abs(verticalRatio - vCenter);

    // Max possible deviation is ~0.5
    const maxDeviation = 0.5;
    const hScore = Math.max(0, 1 - hDeviation / maxDeviation);
    const vScore = Math.max(0, 1 - vDeviation / maxDeviation);

    // Combined with more weight on horizontal (looking left/right is more common)
    const combinedScore = hScore * 0.7 + vScore * 0.3;

    // Apply a curve to make center scores higher and drop off faster at edges
    const curvedScore = Math.pow(combinedScore, 0.8);

    // Scale by confidence
    return curvedScore * confidence * 100;
  }

  /**
   * Head score: how much is the head facing the screen?
   * 100 = directly facing, 0 = turned far away
   */
  private computeHeadScore(features: AttentionFeatures): number {
    if (!features.headPose) return 0;

    const { yaw, pitch, confidence } = features.headPose;
    const maxYaw = this.config.facingScreenThreshold * 2; // Beyond this is 0 score
    const maxPitch = this.config.facingScreenThreshold * 2;

    const yawScore = Math.max(0, 1 - Math.abs(yaw) / maxYaw);
    const pitchScore = Math.max(0, 1 - Math.abs(pitch) / maxPitch);

    const combinedScore = yawScore * 0.6 + pitchScore * 0.4;

    return combinedScore * confidence * 100;
  }

  /**
   * Presence score: is a face detected?
   * 100 = face present with high confidence, 0 = no face
   */
  private computePresenceScore(features: AttentionFeatures): number {
    if (!features.face.detected) return 0;
    return features.face.confidence * 100;
  }

  /**
   * Eye score: are the eyes open?
   * 100 = both eyes fully open, 0 = both closed
   */
  private computeEyeScore(features: AttentionFeatures): number {
    if (!features.eyeState) return 0;

    const { averageEAR, confidence } = features.eyeState;

    // Normalize EAR to 0-1 range (typical range is 0.15-0.35)
    const minEAR = this.config.eyeClosedThreshold;
    const maxEAR = 0.35; // Typical maximum EAR
    const normalized = Math.max(0, Math.min(1, (averageEAR - minEAR) / (maxEAR - minEAR)));

    return normalized * confidence * 100;
  }

  /**
   * Compute the raw attention score from weighted components.
   */
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

  /**
   * Determine the high-level state using a priority-based decision chain.
   */
  private determineState(
    features: AttentionFeatures,
    temporal: TemporalState,
    _scoreComponents: {
      gazeScore: number;
      headScore: number;
      presenceScore: number;
      eyeScore: number;
    },
  ): { state: string; confidence: number } {
    // Priority 1: Absent
    if (!features.face.detected) {
      if (temporal.absentDurationMs > this.config.absentThresholdMs) {
        return { state: 'absent', confidence: 90 };
      }
      if (temporal.absentDurationMs > this.config.absentGraceMs) {
        return { state: 'absent', confidence: 60 };
      }
      // Within grace period — keep last known state or uncertain
      return {
        state: temporal.lastState === 'absent' ? 'absent' : 'uncertain',
        confidence: 30,
      };
    }

    // Priority 2: Eyes closed (prolonged)
    if (features.eyeState && !features.eyeState.leftOpen && !features.eyeState.rightOpen) {
      if (temporal.eyesClosedDurationMs > this.config.prolongedEyeClosureMs) {
        return { state: 'eyes_closed', confidence: 85 };
      }
      // Brief closure — don't classify yet, might be a blink
    }

    // Priority 3: Low confidence — uncertain
    const overallConfidence = this.computeOverallConfidence(features);
    if (overallConfidence < this.config.minConfidenceThreshold) {
      return { state: 'uncertain', confidence: overallConfidence };
    }

    // Priority 4: Directional looking (gaze + head pose combined)
    const direction = this.determineDirection(features);
    if (direction !== 'center' && direction !== 'unknown') {
      const lookingAwayDuration = temporal.lookingAwayDurationMs;

      if (lookingAwayDuration > this.config.lookingAwayThresholdMs) {
        // Map direction to specific state
        switch (direction) {
          case 'left':
            return { state: 'looking_left', confidence: overallConfidence };
          case 'right':
            return { state: 'looking_right', confidence: overallConfidence };
          case 'up':
            return { state: 'looking_up', confidence: overallConfidence };
          case 'down':
            return { state: 'looking_down', confidence: overallConfidence };
        }
      }

      if (lookingAwayDuration > this.config.lookingAwayGraceMs) {
        return { state: 'looking_away', confidence: overallConfidence * 0.7 };
      }

      // Within grace period — still considered focused (brief glance)
    }

    // Priority 5: Head turned significantly
    if (features.headPose) {
      const { yaw, pitch } = features.headPose;

      if (Math.abs(yaw) > this.config.headYawThreshold) {
        if (temporal.lookingAwayDurationMs > this.config.lookingAwayGraceMs) {
          return {
            state: yaw < 0 ? 'looking_left' : 'looking_right',
            confidence: overallConfidence * 0.8,
          };
        }
      }

      if (Math.abs(pitch) > this.config.headPitchThreshold) {
        if (temporal.lookingAwayDurationMs > this.config.lookingAwayGraceMs) {
          return {
            state: pitch < 0 ? 'looking_up' : 'looking_down',
            confidence: overallConfidence * 0.8,
          };
        }
      }
    }

    // Priority 6: Focused
    return { state: 'focused', confidence: overallConfidence };
  }

  /**
   * Determine gaze direction from iris ratios using configured thresholds.
   */
  private determineDirection(features: AttentionFeatures): GazeDirection {
    if (!features.gaze || features.gaze.confidence < 0.3) {
      return 'unknown';
    }

    const { horizontalRatio, verticalRatio } = features.gaze;
    const t = this.config.gazeThresholds;

    // Check horizontal first (more reliable)
    if (horizontalRatio > t.horizontalLeft) return 'left';
    if (horizontalRatio < t.horizontalRight) return 'right';

    // Check vertical
    if (verticalRatio < t.verticalUp) return 'up';
    if (verticalRatio > t.verticalDown) return 'down';

    return 'center';
  }

  /**
   * Compute overall confidence from available features.
   */
  private computeOverallConfidence(features: AttentionFeatures): number {
    const weights = { face: 0.3, gaze: 0.3, headPose: 0.2, eyeState: 0.2 };
    let total = 0;
    let weightSum = 0;

    if (features.face.detected) {
      total += weights.face * features.face.confidence * 100;
      weightSum += weights.face;
    }

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
}
