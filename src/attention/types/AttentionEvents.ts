/**
 * Event type definitions for the AttentionMonitor.
 */

import { AttentionResult, AttentionState } from './AttentionResult';

/** State change event payload */
export interface StateChangeEvent {
  /** Previous attention state */
  previous: AttentionState;

  /** New attention state */
  current: AttentionState;

  /** The full result that triggered the change */
  result: AttentionResult;

  /** How long the previous state lasted (ms) */
  previousStateDurationMs: number;
}

/** Error event payload */
export interface AttentionError {
  /** Error code */
  code:
    | 'CAMERA_NOT_FOUND'
    | 'CAMERA_PERMISSION_DENIED'
    | 'CAMERA_IN_USE'
    | 'CAMERA_DISCONNECTED'
    | 'MODEL_LOAD_FAILED'
    | 'PROCESSING_ERROR'
    | 'UNKNOWN';

  /** Human-readable error message */
  message: string;

  /** Whether the monitor can continue operating */
  recoverable: boolean;

  /** Original error if available */
  originalError?: Error;
}

/** Warning event payload */
export interface AttentionWarning {
  /** Warning code */
  code: 'MULTIPLE_FACES' | 'LOW_CONFIDENCE' | 'LOW_FPS' | 'LANDMARK_INSTABILITY';

  /** Human-readable message */
  message: string;
}

/** Calibration progress event payload */
export interface CalibrationEvent {
  /** Current calibration step */
  step: 'center' | 'left' | 'right' | 'up' | 'down' | 'complete';

  /** Progress (0-1) */
  progress: number;

  /** Instructions for the user */
  instruction: string;
}

/** Map of event names to their payload types */
export interface AttentionEventMap {
  /** Fires on every output cycle with the full result */
  update: AttentionResult;

  /** Fires when the high-level state changes */
  stateChange: StateChangeEvent;

  /** Fires when the user appears to be focused */
  focused: AttentionResult;

  /** Fires when the user appears distracted (looking away, eyes closed) */
  distracted: AttentionResult;

  /** Fires when the user appears absent */
  absent: AttentionResult;

  /** Fires on recoverable or non-recoverable errors */
  error: AttentionError;

  /** Fires on non-critical warnings */
  warning: AttentionWarning;

  /** Fires during calibration */
  calibration: CalibrationEvent;
}
