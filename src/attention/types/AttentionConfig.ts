/**
 * Visual Attention Monitoring Engine - Configuration Types
 */

/**
 * Score weight configuration for the attention score formula.
 * All weights should sum to 1.0.
 */
export interface ScoreWeights {
  /** Weight for gaze direction component (default: 0.35) */
  gaze: number;
  /** Weight for head orientation component (default: 0.30) */
  head: number;
  /** Weight for face presence component (default: 0.20) */
  presence: number;
  /** Weight for eye openness component (default: 0.15) */
  eyes: number;
}

/**
 * Gaze detection threshold configuration.
 * Values represent the iris position ratio deviation from center.
 */
export interface GazeThresholds {
  /** Horizontal ratio threshold for 'left' classification (default: 0.60) */
  horizontalLeft: number;
  /** Horizontal ratio threshold for 'right' classification (default: 0.40) */
  horizontalRight: number;
  /** Vertical ratio threshold for 'up' classification (default: 0.35) */
  verticalUp: number;
  /** Vertical ratio threshold for 'down' classification (default: 0.65) */
  verticalDown: number;
  /** Dead zone around center where gaze is considered 'center' (default: 0.08) */
  centerDeadZone: number;
}

/**
 * Complete configuration interface for the AttentionMonitor.
 * All fields are optional — sensible defaults are provided.
 */
export interface AttentionConfig {
  // --- Processing ---

  /** Target FPS for vision processing (default: 20) */
  processingFps?: number;

  /** Minimum interval between emitted AttentionResult updates in ms (default: 200) */
  outputIntervalMs?: number;

  // --- Temporal thresholds ---

  /** Duration in ms of looking away before classifying as 'looking_away' (default: 1500) */
  lookingAwayThresholdMs?: number;

  /** Duration in ms of face absence before classifying as 'absent' (default: 2500) */
  absentThresholdMs?: number;

  /** Duration in ms of eye closure before classifying as 'eyes_closed' (default: 1200) */
  prolongedEyeClosureMs?: number;

  /** Duration in ms below which looking away is ignored as normal movement (default: 500) */
  lookingAwayGraceMs?: number;

  /** Duration in ms below which face absence is treated as detection failure (default: 1000) */
  absentGraceMs?: number;

  // --- Head pose thresholds ---

  /** Yaw angle threshold (degrees) for 'looking left/right' (default: 20) */
  headYawThreshold?: number;

  /** Pitch angle threshold (degrees) for 'looking up/down' (default: 15) */
  headPitchThreshold?: number;

  /** Maximum yaw/pitch for 'facing screen' classification (default: 25) */
  facingScreenThreshold?: number;

  // --- Eye thresholds ---

  /** EAR threshold below which an eye is considered closed (default: 0.20) */
  eyeClosedThreshold?: number;

  /** EAR threshold above which an eye is considered open (default: 0.25) */
  eyeOpenThreshold?: number;

  // --- Gaze thresholds ---

  /** Custom gaze detection thresholds */
  gazeThresholds?: Partial<GazeThresholds>;

  // --- Scoring ---

  /** Custom score weights (must sum to 1.0) */
  scoreWeights?: Partial<ScoreWeights>;

  /** EMA smoothing factor for attention score (0-1, lower = smoother, default: 0.3) */
  scoreSmoothingAlpha?: number;

  // --- Smoothing ---

  /** Window size in ms for temporal smoothing (default: 1000) */
  smoothingWindowMs?: number;

  // --- Calibration ---

  /** Whether calibration features are enabled (default: true) */
  calibrationEnabled?: boolean;

  // --- Camera ---

  /** Preferred camera device ID (default: use first available) */
  cameraDeviceId?: string;

  /** Preferred camera resolution width (default: 640) */
  cameraWidth?: number;

  /** Preferred camera resolution height (default: 480) */
  cameraHeight?: number;

  // --- MediaPipe ---

  /** Path to the MediaPipe face landmarker model file (default: 'models/face_landmarker.task') */
  modelPath?: string;

  /**
   * Base path for MediaPipe WASM files.
   * Default: uses CDN 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
   */
  wasmBasePath?: string;

  /** Maximum number of faces to detect (default: 1) */
  maxFaces?: number;

  /** Minimum face detection confidence (0-1, default: 0.5) */
  minFaceDetectionConfidence?: number;

  /** Minimum face tracking confidence (0-1, default: 0.5) */
  minFaceTrackingConfidence?: number;

  /** Minimum landmark confidence (0-1, default: 0.5) */
  minLandmarkConfidence?: number;

  // --- Confidence ---

  /** Minimum overall confidence to emit a non-uncertain state (0-100, default: 30) */
  minConfidenceThreshold?: number;

  // --- Debug ---

  /** Enable debug mode with additional internal data in results (default: false) */
  debug?: boolean;
}

/**
 * Resolved configuration with all defaults applied.
 * No optional fields — every value is guaranteed present.
 */
export interface ResolvedAttentionConfig {
  processingFps: number;
  outputIntervalMs: number;

  lookingAwayThresholdMs: number;
  absentThresholdMs: number;
  prolongedEyeClosureMs: number;
  lookingAwayGraceMs: number;
  absentGraceMs: number;

  headYawThreshold: number;
  headPitchThreshold: number;
  facingScreenThreshold: number;

  eyeClosedThreshold: number;
  eyeOpenThreshold: number;

  gazeThresholds: GazeThresholds;
  scoreWeights: ScoreWeights;
  scoreSmoothingAlpha: number;
  smoothingWindowMs: number;

  calibrationEnabled: boolean;

  cameraDeviceId: string | null;
  cameraWidth: number;
  cameraHeight: number;

  modelPath: string;
  wasmBasePath: string;
  maxFaces: number;
  minFaceDetectionConfidence: number;
  minFaceTrackingConfidence: number;
  minLandmarkConfidence: number;

  minConfidenceThreshold: number;

  debug: boolean;
}

/** Default configuration values */
export const DEFAULT_CONFIG: ResolvedAttentionConfig = {
  processingFps: 20,
  outputIntervalMs: 200,

  lookingAwayThresholdMs: 1500,
  absentThresholdMs: 2500,
  prolongedEyeClosureMs: 1200,
  lookingAwayGraceMs: 500,
  absentGraceMs: 1000,

  headYawThreshold: 20,
  headPitchThreshold: 15,
  facingScreenThreshold: 25,

  eyeClosedThreshold: 0.20,
  eyeOpenThreshold: 0.25,

  gazeThresholds: {
    horizontalLeft: 0.60,
    horizontalRight: 0.40,
    verticalUp: 0.35,
    verticalDown: 0.65,
    centerDeadZone: 0.08,
  },

  scoreWeights: {
    gaze: 0.35,
    head: 0.30,
    presence: 0.20,
    eyes: 0.15,
  },

  scoreSmoothingAlpha: 0.3,
  smoothingWindowMs: 1000,

  calibrationEnabled: true,

  cameraDeviceId: null,
  cameraWidth: 640,
  cameraHeight: 480,

  modelPath: 'models/face_landmarker.task',
  wasmBasePath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
  maxFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFaceTrackingConfidence: 0.5,
  minLandmarkConfidence: 0.5,

  minConfidenceThreshold: 30,

  debug: false,
};

/**
 * Resolve a partial user config into a fully-populated config with defaults.
 */
export function resolveConfig(userConfig?: AttentionConfig): ResolvedAttentionConfig {
  if (!userConfig) {
    return { ...DEFAULT_CONFIG };
  }

  const gazeThresholds: GazeThresholds = {
    ...DEFAULT_CONFIG.gazeThresholds,
    ...userConfig.gazeThresholds,
  };

  const scoreWeights: ScoreWeights = {
    ...DEFAULT_CONFIG.scoreWeights,
    ...userConfig.scoreWeights,
  };

  // Validate score weights sum to ~1.0
  const weightSum = scoreWeights.gaze + scoreWeights.head + scoreWeights.presence + scoreWeights.eyes;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AttentionMonitor] Score weights sum to ${weightSum.toFixed(3)}, expected ~1.0. Normalizing.`,
    );
    const factor = 1.0 / weightSum;
    scoreWeights.gaze *= factor;
    scoreWeights.head *= factor;
    scoreWeights.presence *= factor;
    scoreWeights.eyes *= factor;
  }

  return {
    processingFps: userConfig.processingFps ?? DEFAULT_CONFIG.processingFps,
    outputIntervalMs: userConfig.outputIntervalMs ?? DEFAULT_CONFIG.outputIntervalMs,

    lookingAwayThresholdMs:
      userConfig.lookingAwayThresholdMs ?? DEFAULT_CONFIG.lookingAwayThresholdMs,
    absentThresholdMs: userConfig.absentThresholdMs ?? DEFAULT_CONFIG.absentThresholdMs,
    prolongedEyeClosureMs:
      userConfig.prolongedEyeClosureMs ?? DEFAULT_CONFIG.prolongedEyeClosureMs,
    lookingAwayGraceMs: userConfig.lookingAwayGraceMs ?? DEFAULT_CONFIG.lookingAwayGraceMs,
    absentGraceMs: userConfig.absentGraceMs ?? DEFAULT_CONFIG.absentGraceMs,

    headYawThreshold: userConfig.headYawThreshold ?? DEFAULT_CONFIG.headYawThreshold,
    headPitchThreshold: userConfig.headPitchThreshold ?? DEFAULT_CONFIG.headPitchThreshold,
    facingScreenThreshold:
      userConfig.facingScreenThreshold ?? DEFAULT_CONFIG.facingScreenThreshold,

    eyeClosedThreshold: userConfig.eyeClosedThreshold ?? DEFAULT_CONFIG.eyeClosedThreshold,
    eyeOpenThreshold: userConfig.eyeOpenThreshold ?? DEFAULT_CONFIG.eyeOpenThreshold,

    gazeThresholds,
    scoreWeights,
    scoreSmoothingAlpha: userConfig.scoreSmoothingAlpha ?? DEFAULT_CONFIG.scoreSmoothingAlpha,
    smoothingWindowMs: userConfig.smoothingWindowMs ?? DEFAULT_CONFIG.smoothingWindowMs,

    calibrationEnabled: userConfig.calibrationEnabled ?? DEFAULT_CONFIG.calibrationEnabled,

    cameraDeviceId: userConfig.cameraDeviceId ?? DEFAULT_CONFIG.cameraDeviceId,
    cameraWidth: userConfig.cameraWidth ?? DEFAULT_CONFIG.cameraWidth,
    cameraHeight: userConfig.cameraHeight ?? DEFAULT_CONFIG.cameraHeight,

    modelPath: userConfig.modelPath ?? DEFAULT_CONFIG.modelPath,
    wasmBasePath: userConfig.wasmBasePath ?? DEFAULT_CONFIG.wasmBasePath,
    maxFaces: userConfig.maxFaces ?? DEFAULT_CONFIG.maxFaces,
    minFaceDetectionConfidence:
      userConfig.minFaceDetectionConfidence ?? DEFAULT_CONFIG.minFaceDetectionConfidence,
    minFaceTrackingConfidence:
      userConfig.minFaceTrackingConfidence ?? DEFAULT_CONFIG.minFaceTrackingConfidence,
    minLandmarkConfidence:
      userConfig.minLandmarkConfidence ?? DEFAULT_CONFIG.minLandmarkConfidence,

    minConfidenceThreshold:
      userConfig.minConfidenceThreshold ?? DEFAULT_CONFIG.minConfidenceThreshold,

    debug: userConfig.debug ?? DEFAULT_CONFIG.debug,
  };
}
