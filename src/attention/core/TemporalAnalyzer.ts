/**
 * Temporal Analyzer
 *
 * Tracks durations and manages temporal state across frames.
 * This is critical for avoiding per-frame classification jitter.
 *
 * Key responsibilities:
 * - Track how long each condition has persisted (looking away, absent, eyes closed, focused)
 * - Apply temporal thresholds before allowing state transitions
 * - Maintain rolling windows for stability analysis
 * - Provide timing information for the final AttentionResult
 */

import { AttentionFeatures, TemporalState } from '../types/AttentionFeatures';
import { GazeDirection, AttentionState } from '../types/AttentionResult';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';

export class TemporalAnalyzer {
  private readonly config: ResolvedAttentionConfig;

  // Duration tracking
  private lookingAwayStartMs: number | null = null;
  private absentStartMs: number | null = null;
  private eyesClosedStartMs: number | null = null;
  private focusedStartMs: number | null = null;

  // Previous frame state
  private wasLookingAway = false;
  private wasAbsent = false;
  private wereEyesClosed = false;

  // State tracking
  private lastState: AttentionState = 'uncertain';
  private lastStateChangeTimestamp = 0;

  // Gaze direction history for stability
  private gazeHistory: { direction: GazeDirection; timestamp: number }[] = [];
  private readonly gazeHistoryMaxLength = 30;

  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
  }

  /**
   * Update temporal state with new frame features.
   * Call this once per processed frame.
   */
  update(features: AttentionFeatures): TemporalState {
    const now = features.timestamp;

    // Update face absence tracking
    this.updateAbsenceTracking(features.face.detected, now);

    // Update eye closure tracking
    this.updateEyeClosureTracking(features, now);

    // Update gaze/looking-away tracking
    this.updateGazeTracking(features, now);

    // Update focused duration tracking
    this.updateFocusedTracking(now);

    // Build temporal state
    return this.buildTemporalState(now);
  }

  /**
   * Update the tracked state after the classifier has determined the final state.
   * This is called after classification to keep temporal tracking in sync.
   */
  updateState(state: AttentionState, timestamp: number): void {
    if (state !== this.lastState) {
      this.lastStateChangeTimestamp = timestamp;
      this.lastState = state;
    }
  }

  /**
   * Get the duration of the current state in milliseconds.
   */
  getCurrentStateDurationMs(now: number): number {
    if (this.lastStateChangeTimestamp === 0) return 0;
    return now - this.lastStateChangeTimestamp;
  }

  /**
   * Get the last classified state.
   */
  getLastState(): AttentionState {
    return this.lastState;
  }

  /**
   * Reset all temporal tracking state.
   */
  reset(): void {
    this.lookingAwayStartMs = null;
    this.absentStartMs = null;
    this.eyesClosedStartMs = null;
    this.focusedStartMs = null;
    this.wasLookingAway = false;
    this.wasAbsent = false;
    this.wereEyesClosed = false;
    this.lastState = 'uncertain';
    this.lastStateChangeTimestamp = 0;
    this.gazeHistory = [];
  }

  // --- Private tracking methods ---

  private updateAbsenceTracking(faceDetected: boolean, now: number): void {
    if (!faceDetected) {
      if (this.absentStartMs === null) {
        this.absentStartMs = now;
      }
      this.wasAbsent = true;
    } else {
      this.absentStartMs = null;
      this.wasAbsent = false;
    }
  }

  private updateEyeClosureTracking(features: AttentionFeatures, now: number): void {
    if (!features.face.detected || !features.eyeState) {
      // Can't track eyes if no face
      return;
    }

    const eyesClosed = !features.eyeState.leftOpen && !features.eyeState.rightOpen;

    if (eyesClosed) {
      if (this.eyesClosedStartMs === null) {
        this.eyesClosedStartMs = now;
      }
      this.wereEyesClosed = true;
    } else {
      this.eyesClosedStartMs = null;
      this.wereEyesClosed = false;
    }
  }

  private updateGazeTracking(features: AttentionFeatures, now: number): void {
    if (!features.face.detected) {
      // Don't track gaze when face is absent
      return;
    }

    // Determine if user is looking away (gaze not center OR head turned)
    const isLookingAway = this.isCurrentlyLookingAway(features);

    if (isLookingAway) {
      if (this.lookingAwayStartMs === null) {
        this.lookingAwayStartMs = now;
      }
      this.wasLookingAway = true;

      // Reset focused tracking
      this.focusedStartMs = null;
    } else {
      this.lookingAwayStartMs = null;
      this.wasLookingAway = false;
    }

    // Track gaze direction history
    if (features.gaze) {
      const direction = this.classifyGazeDirection(features);
      this.gazeHistory.push({ direction, timestamp: now });

      // Trim history
      while (this.gazeHistory.length > this.gazeHistoryMaxLength) {
        this.gazeHistory.shift();
      }

      // Remove old entries (older than smoothing window)
      const cutoff = now - this.config.smoothingWindowMs;
      this.gazeHistory = this.gazeHistory.filter((entry) => entry.timestamp >= cutoff);
    }
  }

  private updateFocusedTracking(now: number): void {
    // User is focused if not looking away, not absent, and eyes open
    if (!this.wasLookingAway && !this.wasAbsent && !this.wereEyesClosed) {
      if (this.focusedStartMs === null) {
        this.focusedStartMs = now;
      }
    } else {
      this.focusedStartMs = null;
    }
  }

  /**
   * Determine if the user is currently looking away from the screen.
   * Combines gaze direction and head pose signals.
   */
  private isCurrentlyLookingAway(features: AttentionFeatures): boolean {
    // Check gaze direction
    if (features.gaze && features.gaze.confidence > 0.3) {
      const { horizontalRatio, verticalRatio } = features.gaze;
      const t = this.config.gazeThresholds;

      const gazeAway =
        horizontalRatio > t.horizontalLeft ||
        horizontalRatio < t.horizontalRight ||
        verticalRatio < t.verticalUp ||
        verticalRatio > t.verticalDown;

      if (gazeAway) return true;
    }

    // Check head pose
    if (features.headPose && features.headPose.confidence > 0.3) {
      const { yaw, pitch } = features.headPose;

      if (
        Math.abs(yaw) > this.config.headYawThreshold ||
        Math.abs(pitch) > this.config.headPitchThreshold
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Classify raw gaze direction from features.
   */
  private classifyGazeDirection(features: AttentionFeatures): GazeDirection {
    if (!features.gaze || features.gaze.confidence < 0.3) return 'unknown';

    const { horizontalRatio, verticalRatio } = features.gaze;
    const t = this.config.gazeThresholds;

    if (horizontalRatio > t.horizontalLeft) return 'left';
    if (horizontalRatio < t.horizontalRight) return 'right';
    if (verticalRatio < t.verticalUp) return 'up';
    if (verticalRatio > t.verticalDown) return 'down';

    return 'center';
  }

  /**
   * Build the current temporal state snapshot.
   */
  private buildTemporalState(now: number): TemporalState {
    return {
      lookingAwayDurationMs:
        this.lookingAwayStartMs !== null ? now - this.lookingAwayStartMs : 0,
      absentDurationMs: this.absentStartMs !== null ? now - this.absentStartMs : 0,
      eyesClosedDurationMs:
        this.eyesClosedStartMs !== null ? now - this.eyesClosedStartMs : 0,
      focusedDurationMs: this.focusedStartMs !== null ? now - this.focusedStartMs : 0,
      wasLookingAway: this.wasLookingAway,
      wasAbsent: this.wasAbsent,
      wereEyesClosed: this.wereEyesClosed,
      lastState: this.lastState,
      lastStateChangeTimestamp: this.lastStateChangeTimestamp,
    };
  }
}
