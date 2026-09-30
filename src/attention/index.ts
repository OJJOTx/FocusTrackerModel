/**
 * Visual Attention Monitoring Engine
 *
 * A reusable, modular, local real-time library for monitoring
 * observable visual attention signals from a webcam feed.
 *
 * @example
 * ```ts
 * import { AttentionMonitor } from './attention';
 *
 * const monitor = new AttentionMonitor({ debug: true });
 * await monitor.init();
 * monitor.on('update', (result) => console.log(result));
 * monitor.start();
 * ```
 *
 * @packageDocumentation
 */

// Main public class
export { AttentionMonitor } from './core/AttentionMonitor';

// Types
export type {
  AttentionResult,
  AttentionState,
  GazeDirection,
  GazeInfo,
  HeadPoseInfo,
  EyeInfo,
  TimingInfo,
  DebugInfo,
} from './types/AttentionResult';

export type {
  AttentionConfig,
  ResolvedAttentionConfig,
  ScoreWeights,
  GazeThresholds,
} from './types/AttentionConfig';

export { DEFAULT_CONFIG, resolveConfig } from './types/AttentionConfig';

export type {
  AttentionEventMap,
  StateChangeEvent,
  AttentionError,
  AttentionWarning,
  CalibrationEvent,
} from './types/AttentionEvents';

export type {
  AttentionFeatures,
  GazeFeatures,
  HeadPoseFeatures,
  EyeStateFeatures,
  CalibrationData,
} from './types/AttentionFeatures';

// Classifier interface (for custom classifiers)
export type { AttentionClassifier } from './classifiers/AttentionClassifier';
export type { AttentionPrediction, TemporalState } from './types/AttentionFeatures';

// Camera manager (for advanced usage)
export { CameraManager } from './camera/CameraManager';

// Calibration manager (for advanced usage)
export { CalibrationManager } from './calibration/CalibrationManager';
export type { CalibrationStep } from './calibration/CalibrationManager';
