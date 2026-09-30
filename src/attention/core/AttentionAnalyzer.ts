/**
 * Attention Analyzer
 *
 * Combines feature extraction results with temporal analysis to produce
 * the final AttentionResult. Orchestrates the classifier and scoring.
 */

import { AttentionFeatures, TemporalState } from '../types/AttentionFeatures';
import {
  AttentionResult,
  AttentionState,
  GazeDirection,
  DebugInfo,
} from '../types/AttentionResult';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { AttentionClassifier } from '../classifiers/AttentionClassifier';
import { ExponentialMovingAverage } from '../utils/smoothing';

export class AttentionAnalyzer {
  private readonly config: ResolvedAttentionConfig;
  private readonly classifier: AttentionClassifier;
  private readonly scoreEMA: ExponentialMovingAverage;

  // Performance tracking
  private frameCount = 0;
  private lastFpsTimestamp = 0;
  private currentFps = 0;

  constructor(config: ResolvedAttentionConfig, classifier: AttentionClassifier) {
    this.config = config;
    this.classifier = classifier;
    this.scoreEMA = new ExponentialMovingAverage(config.scoreSmoothingAlpha);
  }

  /**
   * Analyze features and temporal state to produce a complete AttentionResult.
   */
  analyze(
    features: AttentionFeatures,
    temporal: TemporalState,
    processingLatencyMs: number,
  ): AttentionResult {
    // Run classifier
    const prediction = this.classifier.classify(features, temporal);

    // Smooth the score
    const rawScore = prediction.rawScore;
    const smoothedScore = this.scoreEMA.update(rawScore);

    // Map state string to AttentionState type
    const state = prediction.state as AttentionState;

    // Determine gaze direction
    const gazeDirection = this.determineGazeDirection(features);

    // Compute head facing screen
    const facingScreen = this.isHeadFacingScreen(features);

    // Update FPS tracking
    this.updateFps(features.timestamp);

    // Build result
    const result: AttentionResult = {
      timestamp: features.timestamp,
      facePresent: features.face.detected,
      state,
      attentionScore: Math.round(smoothedScore * 10) / 10,
      confidence: Math.round(prediction.confidence * 10) / 10,

      gaze: {
        direction: gazeDirection,
        horizontal: features.gaze
          ? this.normalizeGazeRatio(features.gaze.horizontalRatio)
          : 0,
        vertical: features.gaze
          ? this.normalizeGazeRatio(features.gaze.verticalRatio)
          : 0,
        confidence: features.gaze
          ? Math.round(features.gaze.confidence * 100)
          : 0,
      },

      headPose: {
        yaw: features.headPose ? Math.round(features.headPose.yaw * 10) / 10 : 0,
        pitch: features.headPose ? Math.round(features.headPose.pitch * 10) / 10 : 0,
        roll: features.headPose ? Math.round(features.headPose.roll * 10) / 10 : 0,
        facingScreen,
      },

      eyes: {
        leftOpen: features.eyeState?.leftOpen ?? false,
        rightOpen: features.eyeState?.rightOpen ?? false,
        openness: features.eyeState
          ? Math.round(Math.min(1, features.eyeState.averageEAR / 0.3) * 100) / 100
          : 0,
        closedDurationMs: temporal.eyesClosedDurationMs,
      },

      timing: {
        lookingAwayMs: temporal.lookingAwayDurationMs,
        absentMs: temporal.absentDurationMs,
        focusedMs: temporal.focusedDurationMs,
      },
    };

    // Add debug info if enabled
    if (this.config.debug) {
      result.debug = this.buildDebugInfo(
        features,
        rawScore,
        smoothedScore,
        processingLatencyMs,
        prediction.scoreComponents,
      );
    }

    return result;
  }

  /**
   * Reset internal state.
   */
  reset(): void {
    this.scoreEMA.reset();
    this.frameCount = 0;
    this.lastFpsTimestamp = 0;
    this.currentFps = 0;
  }

  /**
   * Determine gaze direction from features using configured thresholds.
   */
  private determineGazeDirection(features: AttentionFeatures): GazeDirection {
    if (!features.gaze || features.gaze.confidence < 0.3) {
      return 'unknown';
    }

    const { horizontalRatio, verticalRatio } = features.gaze;
    const t = this.config.gazeThresholds;

    if (horizontalRatio > t.horizontalLeft) return 'left';
    if (horizontalRatio < t.horizontalRight) return 'right';
    if (verticalRatio < t.verticalUp) return 'up';
    if (verticalRatio > t.verticalDown) return 'down';

    return 'center';
  }

  /**
   * Check if head is approximately facing the screen.
   */
  private isHeadFacingScreen(features: AttentionFeatures): boolean {
    if (!features.headPose) return false;

    const { yaw, pitch } = features.headPose;
    const threshold = this.config.facingScreenThreshold;

    return Math.abs(yaw) < threshold && Math.abs(pitch) < threshold;
  }

  /**
   * Normalize gaze ratio from [0, 1] to approximately [-1, 1].
   * 0.5 maps to 0, 0 maps to -1, 1 maps to 1.
   */
  private normalizeGazeRatio(ratio: number): number {
    return Math.round((ratio - 0.5) * 2 * 100) / 100;
  }

  /**
   * Update FPS counter.
   */
  private updateFps(timestamp: number): void {
    this.frameCount++;
    if (this.lastFpsTimestamp === 0) {
      this.lastFpsTimestamp = timestamp;
      return;
    }

    const elapsed = timestamp - this.lastFpsTimestamp;
    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount / elapsed) * 1000);
      this.frameCount = 0;
      this.lastFpsTimestamp = timestamp;
    }
  }

  /**
   * Build debug information.
   */
  private buildDebugInfo(
    features: AttentionFeatures,
    rawScore: number,
    smoothedScore: number,
    processingLatencyMs: number,
    scoreComponents: {
      gazeScore: number;
      headScore: number;
      presenceScore: number;
      eyeScore: number;
    },
  ): DebugInfo {
    return {
      rawScore: Math.round(rawScore * 10) / 10,
      smoothedScore: Math.round(smoothedScore * 10) / 10,
      fps: this.currentFps,
      processingLatencyMs: Math.round(processingLatencyMs * 10) / 10,
      rawIrisHorizontalLeft: features.gaze?.horizontalRatioLeft ?? 0,
      rawIrisHorizontalRight: features.gaze?.horizontalRatioRight ?? 0,
      rawIrisVerticalLeft: features.gaze?.verticalRatioLeft ?? 0,
      rawIrisVerticalRight: features.gaze?.verticalRatioRight ?? 0,
      leftEAR: features.eyeState?.leftEAR ?? 0,
      rightEAR: features.eyeState?.rightEAR ?? 0,
      scoreComponents: {
        gazeScore: Math.round(scoreComponents.gazeScore * 10) / 10,
        headScore: Math.round(scoreComponents.headScore * 10) / 10,
        presenceScore: Math.round(scoreComponents.presenceScore * 10) / 10,
        eyeScore: Math.round(scoreComponents.eyeScore * 10) / 10,
      },
      facesDetected: features.face.faceCount,
      calibrationActive: false, // Will be set by the monitor
    };
  }
}
