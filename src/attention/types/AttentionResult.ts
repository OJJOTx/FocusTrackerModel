/**
 * Visual Attention Monitoring Engine - Result Types
 *
 * These types represent the output of the attention monitoring pipeline.
 * All values are derived from observable visual signals only.
 *
 * IMPORTANT: This system monitors observable visual attention indicators.
 * It does NOT detect mental focus, understanding, or cognitive engagement.
 */

/** Possible high-level attention states */
export type AttentionState =
  | 'focused'
  | 'looking_away'
  | 'looking_left'
  | 'looking_right'
  | 'looking_up'
  | 'looking_down'
  | 'eyes_closed'
  | 'absent'
  | 'uncertain';

/** Gaze direction classification */
export type GazeDirection = 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';

/**
 * Complete attention monitoring result emitted on each update cycle.
 *
 * All numeric angles are in degrees.
 * All durations are in milliseconds.
 * Score and confidence values are in the range [0, 100].
 */
export interface AttentionResult {
  /** Unix timestamp (ms) when this result was generated */
  timestamp: number;

  /** Whether a face is currently detected in the frame */
  facePresent: boolean;

  /** High-level attention state classification */
  state: AttentionState;

  /**
   * Overall visual attention score (0-100).
   * Computed from weighted combination of gaze, head pose, presence, and eye state.
   * Smoothed over time to avoid rapid fluctuations.
   */
  attentionScore: number;

  /**
   * Overall confidence in the current classification (0-100).
   * Lower when landmarks are unstable, lighting is poor, or face is partially visible.
   */
  confidence: number;

  /** Gaze estimation details */
  gaze: GazeInfo;

  /** Head pose estimation details */
  headPose: HeadPoseInfo;

  /** Eye state details */
  eyes: EyeInfo;

  /** Temporal timing information */
  timing: TimingInfo;

  /** Debug information (only populated when debug mode is enabled) */
  debug?: DebugInfo;
}

/** Gaze estimation information */
export interface GazeInfo {
  /** Classified gaze direction */
  direction: GazeDirection;

  /**
   * Horizontal gaze ratio.
   * Negative = looking left, Positive = looking right.
   * Normalized approximately to [-1, 1].
   */
  horizontal: number;

  /**
   * Vertical gaze ratio.
   * Negative = looking up, Positive = looking down.
   * Normalized approximately to [-1, 1].
   */
  vertical: number;

  /** Confidence in gaze estimation (0-100) */
  confidence: number;
}

/** Head pose estimation information */
export interface HeadPoseInfo {
  /** Yaw angle in degrees. Negative = turned left, Positive = turned right */
  yaw: number;

  /** Pitch angle in degrees. Negative = looking up, Positive = looking down */
  pitch: number;

  /** Roll angle in degrees. Negative = tilted left, Positive = tilted right */
  roll: number;

  /** Whether the head is approximately facing the screen */
  facingScreen: boolean;
}

/** Eye state information */
export interface EyeInfo {
  /** Whether the left eye appears open */
  leftOpen: boolean;

  /** Whether the right eye appears open */
  rightOpen: boolean;

  /**
   * Average eye openness ratio (0-1).
   * 0 = fully closed, 1 = fully open (relative to individual baseline).
   */
  openness: number;

  /** Duration in ms that eyes have been continuously closed */
  closedDurationMs: number;
}

/** Temporal timing information */
export interface TimingInfo {
  /** Duration in ms the user has been looking away from screen */
  lookingAwayMs: number;

  /** Duration in ms since face was last detected */
  absentMs: number;

  /** Duration in ms the user has been in a focused state */
  focusedMs: number;
}

/** Debug information available when debug mode is enabled */
export interface DebugInfo {
  /** Raw (unsmoothed) attention score */
  rawScore: number;

  /** Smoothed attention score */
  smoothedScore: number;

  /** Processing frames per second */
  fps: number;

  /** Time taken to process the last frame (ms) */
  processingLatencyMs: number;

  /** Raw iris horizontal ratio (left eye) */
  rawIrisHorizontalLeft: number;

  /** Raw iris horizontal ratio (right eye) */
  rawIrisHorizontalRight: number;

  /** Raw iris vertical ratio (left eye) */
  rawIrisVerticalLeft: number;

  /** Raw iris vertical ratio (right eye) */
  rawIrisVerticalRight: number;

  /** Left eye aspect ratio */
  leftEAR: number;

  /** Right eye aspect ratio */
  rightEAR: number;

  /** Individual score components */
  scoreComponents: {
    gazeScore: number;
    headScore: number;
    presenceScore: number;
    eyeScore: number;
  };

  /** Number of faces detected */
  facesDetected: number;

  /** Whether calibration data is active */
  calibrationActive: boolean;
}
