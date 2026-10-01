/**
 * Temporal Analyzer
 *
 * Stabilizes per-frame signals into duration-aware attention state.
 * Uses a rolling window plus hysteresis so one noisy frame does not
 * reset a genuine look-away event, and requires stable face reacquisition
 * before leaving an absent state.
 */

import { AttentionFeatures, TemporalState } from '../types/AttentionFeatures';
import { GazeDirection, AttentionState } from '../types/AttentionResult';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';

export class TemporalAnalyzer {
  private readonly config: ResolvedAttentionConfig;

  private lookingAwayStartMs: number | null = null;
  private absentStartMs: number | null = null;
  private eyesClosedStartMs: number | null = null;
  private focusedStartMs: number | null = null;
  private faceReacquiredStartMs: number | null = null;

  private wasLookingAway = false;
  private wasAbsent = false;
  private wereEyesClosed = false;

  private lastState: AttentionState = 'uncertain';
  private lastStateChangeTimestamp = 0;

  private gazeHistory: { direction: GazeDirection; timestamp: number }[] = [];
  private readonly gazeHistoryMaxLength = 60;

  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
  }

  update(features: AttentionFeatures): TemporalState {
    const now = features.timestamp;

    this.updateAbsenceTracking(features.face.detected, now);
    this.updateEyeClosureTracking(features, now);
    this.updateGazeTracking(features, now);
    this.updateFocusedTracking(now);

    return this.buildTemporalState(now);
  }

  updateState(state: AttentionState, timestamp: number): void {
    if (state !== this.lastState) {
      this.lastStateChangeTimestamp = timestamp;
      this.lastState = state;
    }
  }

  getCurrentStateDurationMs(now: number): number {
    if (this.lastStateChangeTimestamp === 0) return 0;
    return now - this.lastStateChangeTimestamp;
  }

  getLastState(): AttentionState {
    return this.lastState;
  }

  reset(): void {
    this.lookingAwayStartMs = null;
    this.absentStartMs = null;
    this.eyesClosedStartMs = null;
    this.focusedStartMs = null;
    this.faceReacquiredStartMs = null;
    this.wasLookingAway = false;
    this.wasAbsent = false;
    this.wereEyesClosed = false;
    this.lastState = 'uncertain';
    this.lastStateChangeTimestamp = 0;
    this.gazeHistory = [];
  }

  private updateAbsenceTracking(faceDetected: boolean, now: number): void {
    if (!faceDetected) {
      if (this.absentStartMs === null) {
        this.absentStartMs = now;
      }
      this.faceReacquiredStartMs = null;
      this.wasAbsent = true;
      return;
    }

    if (this.absentStartMs === null) {
      this.wasAbsent = false;
      this.faceReacquiredStartMs = null;
      return;
    }

    const absenceDuration = now - this.absentStartMs;
    if (absenceDuration < this.config.absentGraceMs) {
      // Ignore tiny detector dropouts without forcing a long reacquisition hold.
      this.absentStartMs = null;
      this.faceReacquiredStartMs = null;
      this.wasAbsent = false;
      return;
    }

    // A face has returned after a meaningful loss. Do not instantly clear absence:
    // require continuous detection for a short reacquisition period.
    if (this.faceReacquiredStartMs === null) {
      this.faceReacquiredStartMs = now;
      this.wasAbsent = true;
      return;
    }

    if (now - this.faceReacquiredStartMs >= this.config.faceReacquisitionMs) {
      this.absentStartMs = null;
      this.faceReacquiredStartMs = null;
      this.wasAbsent = false;
    } else {
      this.wasAbsent = true;
    }
  }

  private updateEyeClosureTracking(features: AttentionFeatures, now: number): void {
    if (!features.face.detected || !features.eyeState || features.eyeState.confidence < 0.25) {
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
    if (!features.face.detected || this.wasAbsent) {
      return;
    }

    const direction = this.classifyCombinedDirection(features);
    this.gazeHistory.push({ direction, timestamp: now });
    this.trimHistory(now);

    const ratio = this.computeLookingAwayRatio();
    const isKnown = this.gazeHistory.some((entry) => entry.direction !== 'unknown');

    if (!isKnown) {
      return;
    }

    if (!this.wasLookingAway && ratio >= this.config.lookingAwayEnterRatio) {
      this.wasLookingAway = true;
      if (this.lookingAwayStartMs === null) {
        this.lookingAwayStartMs = this.firstAwayTimestamp() ?? now;
      }
      this.focusedStartMs = null;
    } else if (this.wasLookingAway && ratio <= this.config.lookingAwayExitRatio) {
      this.wasLookingAway = false;
      this.lookingAwayStartMs = null;
    }

    if (this.wasLookingAway && this.lookingAwayStartMs === null) {
      this.lookingAwayStartMs = this.firstAwayTimestamp() ?? now;
    }
  }

  private updateFocusedTracking(now: number): void {
    if (!this.wasLookingAway && !this.wasAbsent && !this.wereEyesClosed) {
      if (this.focusedStartMs === null) {
        this.focusedStartMs = now;
      }
    } else {
      this.focusedStartMs = null;
    }
  }

  private classifyCombinedDirection(features: AttentionFeatures): GazeDirection {
    // Head pose gets priority when it is clearly beyond the configured threshold.
    // This prevents noisy vertical iris motion from overriding an obvious head turn.
    if (features.headPose && features.headPose.confidence >= 0.3) {
      const { yaw, pitch } = features.headPose;

      if (Math.abs(yaw) > this.config.headYawThreshold) {
        return yaw < 0 ? 'left' : 'right';
      }

      if (Math.abs(pitch) > this.config.headPitchThreshold) {
        return pitch < 0 ? 'up' : 'down';
      }
    }

    if (!features.gaze || features.gaze.confidence < 0.3) {
      return 'unknown';
    }

    const { horizontalRatio, verticalRatio } = features.gaze;
    const t = this.config.gazeThresholds;

    const horizontalDistance = Math.abs(horizontalRatio - 0.5);
    const verticalDistance = Math.abs(verticalRatio - 0.5);

    // Respect the configured center dead zone before directional thresholds.
    if (
      horizontalDistance <= t.centerDeadZone &&
      verticalDistance <= t.centerDeadZone
    ) {
      return 'center';
    }

    if (horizontalRatio > t.horizontalLeft) return 'left';
    if (horizontalRatio < t.horizontalRight) return 'right';
    if (verticalRatio < t.verticalUp) return 'up';
    if (verticalRatio > t.verticalDown) return 'down';

    return 'center';
  }

  private trimHistory(now: number): void {
    const cutoff = now - this.config.smoothingWindowMs;
    this.gazeHistory = this.gazeHistory.filter((entry) => entry.timestamp >= cutoff);

    while (this.gazeHistory.length > this.gazeHistoryMaxLength) {
      this.gazeHistory.shift();
    }
  }

  private computeLookingAwayRatio(): number {
    const known = this.gazeHistory.filter((entry) => entry.direction !== 'unknown');
    if (known.length === 0) return 0;

    const away = known.filter((entry) => entry.direction !== 'center').length;
    return away / known.length;
  }

  private firstAwayTimestamp(): number | null {
    const first = this.gazeHistory.find(
      (entry) => entry.direction !== 'center' && entry.direction !== 'unknown',
    );
    return first?.timestamp ?? null;
  }

  private stableDirection(): GazeDirection {
    const known = this.gazeHistory.filter(
      (entry) => entry.direction !== 'unknown' && entry.direction !== 'center',
    );
    if (known.length === 0) return 'center';

    const counts = new Map<GazeDirection, number>();
    for (const entry of known) {
      counts.set(entry.direction, (counts.get(entry.direction) ?? 0) + 1);
    }

    let best: GazeDirection = 'unknown';
    let bestCount = 0;
    for (const [direction, count] of counts) {
      if (count > bestCount) {
        best = direction;
        bestCount = count;
      }
    }

    return best;
  }

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
      stableDirection: this.stableDirection(),
      lookingAwayRatio: this.computeLookingAwayRatio(),
      faceReacquiring: this.faceReacquiredStartMs !== null,
      lastState: this.lastState,
      lastStateChangeTimestamp: this.lastStateChangeTimestamp,
    };
  }
}
