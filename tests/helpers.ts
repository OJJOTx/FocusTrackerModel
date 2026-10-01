/**
 * Shared test helpers for creating mock data that matches
 * the actual AttentionFeatures interface.
 */

import type {
  AttentionFeatures,
  FaceDetectionResult,
  GazeFeatures,
  HeadPoseFeatures,
  EyeStateFeatures,
  FaceLandmark,
} from '../src/attention/types/AttentionFeatures';

/**
 * Create an array of 478 face landmarks with default values.
 * All landmarks default to (0.5, 0.5, 0).
 */
export function createMockLandmarks(): FaceLandmark[] {
  return Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

/**
 * Create a mock FaceDetectionResult.
 */
export function createMockFace(
  overrides: Partial<FaceDetectionResult> = {},
): FaceDetectionResult {
  return {
    detected: true,
    faceCount: 1,
    landmarks: createMockLandmarks(),
    confidence: 0.95,
    frameWidth: 640,
    frameHeight: 480,
    ...overrides,
  };
}

/**
 * Create mock GazeFeatures.
 */
export function createMockGaze(overrides: Partial<GazeFeatures> = {}): GazeFeatures {
  return {
    horizontalRatioLeft: 0.5,
    horizontalRatioRight: 0.5,
    verticalRatioLeft: 0.5,
    verticalRatioRight: 0.5,
    horizontalRatio: 0.5,
    verticalRatio: 0.5,
    confidence: 0.9,
    ...overrides,
  };
}

/**
 * Create mock HeadPoseFeatures.
 */
export function createMockHeadPose(
  overrides: Partial<HeadPoseFeatures> = {},
): HeadPoseFeatures {
  return {
    yaw: 0,
    pitch: 0,
    roll: 0,
    confidence: 0.9,
    ...overrides,
  };
}

/**
 * Create mock EyeStateFeatures.
 */
export function createMockEyeState(
  overrides: Partial<EyeStateFeatures> = {},
): EyeStateFeatures {
  return {
    leftEAR: 0.3,
    rightEAR: 0.3,
    averageEAR: 0.3,
    leftOpen: true,
    rightOpen: true,
    leftConfidence: 0.9,
    rightConfidence: 0.9,
    confidence: 0.9,
    ...overrides,
  };
}

/**
 * Create complete mock AttentionFeatures with sensible defaults.
 * Defaults represent a focused user looking at the screen.
 */
export function createMockFeatures(overrides: {
  timestamp?: number;
  face?: Partial<FaceDetectionResult>;
  gaze?: Partial<GazeFeatures> | null;
  headPose?: Partial<HeadPoseFeatures> | null;
  eyeState?: Partial<EyeStateFeatures> | null;
} = {}): AttentionFeatures {
  return {
    timestamp: overrides.timestamp ?? Date.now(),
    face: createMockFace(overrides.face),
    gaze: overrides.gaze === null ? null : createMockGaze(overrides.gaze ?? {}),
    headPose: overrides.headPose === null
      ? null
      : createMockHeadPose(overrides.headPose ?? {}),
    eyeState: overrides.eyeState === null
      ? null
      : createMockEyeState(overrides.eyeState ?? {}),
  };
}

/**
 * Create features representing an absent user (no face detected).
 */
export function createAbsentFeatures(timestamp: number): AttentionFeatures {
  return {
    timestamp,
    face: createMockFace({ detected: false, faceCount: 0, landmarks: null, confidence: 0 }),
    gaze: null,
    headPose: null,
    eyeState: null,
  };
}

/**
 * Create features representing a user looking in a specific direction.
 */
export function createLookingFeatures(
  timestamp: number,
  direction: 'left' | 'right' | 'up' | 'down',
): AttentionFeatures {
  const gazeOverrides: Partial<GazeFeatures> = {};
  const headOverrides: Partial<HeadPoseFeatures> = {};

  switch (direction) {
    case 'left':
      gazeOverrides.horizontalRatio = 0.75;
      headOverrides.yaw = -30;
      break;
    case 'right':
      gazeOverrides.horizontalRatio = 0.25;
      headOverrides.yaw = 30;
      break;
    case 'up':
      gazeOverrides.verticalRatio = 0.2;
      headOverrides.pitch = -25;
      break;
    case 'down':
      gazeOverrides.verticalRatio = 0.8;
      headOverrides.pitch = 25;
      break;
  }

  return createMockFeatures({
    timestamp,
    gaze: gazeOverrides,
    headPose: headOverrides,
  });
}

/**
 * Create features representing closed eyes.
 */
export function createEyesClosedFeatures(timestamp: number): AttentionFeatures {
  return createMockFeatures({
    timestamp,
    eyeState: {
      leftEAR: 0.1,
      rightEAR: 0.1,
      averageEAR: 0.1,
      leftOpen: false,
      rightOpen: false,
    },
  });
}
