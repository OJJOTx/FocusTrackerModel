/**
 * Internal feature extraction types used between pipeline stages.
 * These are NOT part of the public API.
 */

/** A 2D point in normalized coordinates (0-1) */
export interface Point2D {
  x: number;
  y: number;
}

/** A 3D point */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Normalized face landmark from MediaPipe */
export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

/** Result of face detection */
export interface FaceDetectionResult {
  /** Whether at least one face was found */
  detected: boolean;

  /** Total number of faces detected in the frame */
  faceCount: number;

  /** 478 face landmarks (normalized 0-1) for the primary face, or null if no face */
  landmarks: FaceLandmark[] | null;

  /** Derived face/landmark quality confidence (0-1) */
  confidence: number;

  /** Frame dimensions used for denormalization */
  frameWidth: number;
  frameHeight: number;
}

/** Raw gaze estimation output */
export interface GazeFeatures {
  /** Horizontal gaze ratio for left eye (0=inner corner, 1=outer corner) */
  horizontalRatioLeft: number;

  /** Horizontal gaze ratio for right eye (0=inner corner, 1=outer corner) */
  horizontalRatioRight: number;

  /** Vertical gaze ratio for left eye (0=top, 1=bottom) */
  verticalRatioLeft: number;

  /** Vertical gaze ratio for right eye (0=top, 1=bottom) */
  verticalRatioRight: number;

  /**
   * Canonical horizontal gaze ratio.
   * Internally, values above 0.5 mean visual-left and values below 0.5 mean visual-right.
   */
  horizontalRatio: number;

  /** Average/calibrated vertical ratio (0=up, 1=down) */
  verticalRatio: number;

  /** Confidence in gaze estimation (0-1) */
  confidence: number;
}

/** Raw head pose output */
export interface HeadPoseFeatures {
  /** Yaw in degrees (- = left, + = right) */
  yaw: number;

  /** Pitch in degrees (- = up, + = down) */
  pitch: number;

  /** Roll in degrees (- = tilted left, + = tilted right) */
  roll: number;

  /** Confidence in pose estimation (0-1) */
  confidence: number;
}

/** Raw eye state output */
export interface EyeStateFeatures {
  /** Left eye aspect ratio */
  leftEAR: number;

  /** Right eye aspect ratio */
  rightEAR: number;

  /** Average EAR */
  averageEAR: number;

  /** Whether left eye is open */
  leftOpen: boolean;

  /** Whether right eye is open */
  rightOpen: boolean;

  /** Confidence in left-eye geometry/state (0-1) */
  leftConfidence: number;

  /** Confidence in right-eye geometry/state (0-1) */
  rightConfidence: number;

  /** Confidence in eye state (0-1) */
  confidence: number;
}

/**
 * Combined features from all vision estimators for a single frame.
 * Passed to the attention analyzer for classification.
 */
export interface AttentionFeatures {
  /** Timestamp when features were extracted */
  timestamp: number;

  /** Face detection features */
  face: FaceDetectionResult;

  /** Gaze features (null if no face) */
  gaze: GazeFeatures | null;

  /** Head pose features (null if no face) */
  headPose: HeadPoseFeatures | null;

  /** Eye state features (null if no face) */
  eyeState: EyeStateFeatures | null;
}

/**
 * Temporal state tracked across frames.
 */
export interface TemporalState {
  /** Duration in ms that gaze/head has been stably away from center */
  lookingAwayDurationMs: number;

  /** Duration in ms that face has been effectively absent/not usable */
  absentDurationMs: number;

  /** Duration in ms that eyes have been closed */
  eyesClosedDurationMs: number;

  /** Duration in ms that user has been in focused state */
  focusedDurationMs: number;

  /** Whether user is stably looking away after temporal smoothing */
  wasLookingAway: boolean;

  /** Whether face is effectively absent (includes reacquisition hold) */
  wasAbsent: boolean;

  /** Whether eyes were closed in the previous frame */
  wereEyesClosed: boolean;

  /** Stable combined gaze/head direction from the rolling window */
  stableDirection: 'center' | 'left' | 'right' | 'up' | 'down' | 'unknown';

  /** Fraction of known samples in the smoothing window that indicate looking away */
  lookingAwayRatio: number;

  /** True while a face has reappeared but has not yet satisfied reacquisition hysteresis */
  faceReacquiring: boolean;

  /** Last known state */
  lastState: string;

  /** Timestamp of last state change */
  lastStateChangeTimestamp: number;
}

/**
 * Prediction from the attention classifier.
 */
export interface AttentionPrediction {
  state: string;
  confidence: number;
  rawScore: number;
  scoreComponents: {
    gazeScore: number;
    headScore: number;
    presenceScore: number;
    eyeScore: number;
  };
}

/**
 * Calibration data collected during calibration sessions.
 */
export interface CalibrationData {
  /** Center gaze ratios */
  center: { horizontal: number; vertical: number } | null;

  /** Left gaze ratios */
  left: { horizontal: number; vertical: number } | null;

  /** Right gaze ratios */
  right: { horizontal: number; vertical: number } | null;

  /** Up gaze ratios */
  up: { horizontal: number; vertical: number } | null;

  /** Down gaze ratios */
  down: { horizontal: number; vertical: number } | null;

  /**
   * Neutral head pose captured while the user looks at screen center.
   * Optional for backward compatibility with calibration data saved by V1.
   */
  headPoseCenter?: { yaw: number; pitch: number; roll: number } | null;

  /** Whether calibration is complete */
  isCalibrated: boolean;

  /** Timestamp of calibration */
  calibratedAt: number | null;
}
