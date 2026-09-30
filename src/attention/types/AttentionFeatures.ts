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

  /** Detection confidence (0-1) */
  confidence: number;

  /** Frame dimensions used for denormalization */
  frameWidth: number;
  frameHeight: number;
}

/** Raw gaze estimation output */
export interface GazeFeatures {
  /** Horizontal gaze ratio for left eye (0=inner corner, 1=outer corner) */
  horizontalRatioLeft: number;

  /** Horizontal gaze ratio for right eye */
  horizontalRatioRight: number;

  /** Vertical gaze ratio for left eye (0=top, 1=bottom) */
  verticalRatioLeft: number;

  /** Vertical gaze ratio for right eye */
  verticalRatioRight: number;

  /** Average horizontal ratio */
  horizontalRatio: number;

  /** Average vertical ratio */
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
  /** Duration in ms that gaze has been away from center */
  lookingAwayDurationMs: number;

  /** Duration in ms that face has been absent */
  absentDurationMs: number;

  /** Duration in ms that eyes have been closed */
  eyesClosedDurationMs: number;

  /** Duration in ms that user has been in focused state */
  focusedDurationMs: number;

  /** Whether user was looking away in the previous frame */
  wasLookingAway: boolean;

  /** Whether face was absent in the previous frame */
  wasAbsent: boolean;

  /** Whether eyes were closed in the previous frame */
  wereEyesClosed: boolean;

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

  /** Whether calibration is complete */
  isCalibrated: boolean;

  /** Timestamp of calibration */
  calibratedAt: number | null;
}
