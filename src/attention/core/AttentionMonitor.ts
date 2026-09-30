/**
 * AttentionMonitor — Public API
 *
 * The main entry point for the Visual Attention Monitoring Engine.
 * Provides a simple, event-based API for monitoring observable visual attention signals.
 *
 * Usage:
 * ```ts
 * import { AttentionMonitor } from './attention';
 *
 * const monitor = new AttentionMonitor({ debug: true });
 * await monitor.init();
 *
 * monitor.on('update', (result) => console.log(result));
 * monitor.on('stateChange', ({ previous, current }) => {
 *   console.log(`${previous} -> ${current}`);
 * });
 *
 * monitor.start();
 *
 * // Later:
 * monitor.stop();
 * monitor.destroy();
 * ```
 *
 * IMPORTANT: This system monitors observable visual attention indicators only.
 * It does NOT detect mental focus, understanding, or cognitive engagement.
 */

import { AttentionConfig, ResolvedAttentionConfig, resolveConfig } from '../types/AttentionConfig';
import { AttentionResult, AttentionState } from '../types/AttentionResult';
import {
  AttentionEventMap,
  StateChangeEvent,
  AttentionError,
  AttentionWarning,
} from '../types/AttentionEvents';
import { CameraManager } from '../camera/CameraManager';
import { FaceDetector } from '../vision/FaceDetector';
import { HeadPoseEstimator } from '../vision/HeadPoseEstimator';
import { GazeEstimator } from '../vision/GazeEstimator';
import { EyeStateEstimator } from '../vision/EyeStateEstimator';
import { TemporalAnalyzer } from './TemporalAnalyzer';
import { AttentionAnalyzer } from './AttentionAnalyzer';
import { ProcessingPipeline } from './ProcessingPipeline';
import { RuleBasedClassifier } from '../classifiers/RuleBasedClassifier';
import { CalibrationManager } from '../calibration/CalibrationManager';

type EventCallback<T> = (data: T) => void;

/**
 * Main public class for the Visual Attention Monitoring Engine.
 *
 * Manages the full lifecycle: camera → detection → analysis → events.
 * Designed for integration into Electron renderer processes.
 */
export class AttentionMonitor {
  private readonly config: ResolvedAttentionConfig;

  // Internal components
  private cameraManager: CameraManager;
  private faceDetector: FaceDetector;
  private headPoseEstimator: HeadPoseEstimator;
  private gazeEstimator: GazeEstimator;
  private eyeStateEstimator: EyeStateEstimator;
  private temporalAnalyzer: TemporalAnalyzer;
  private attentionAnalyzer: AttentionAnalyzer;
  private pipeline: ProcessingPipeline;
  private calibrationManager: CalibrationManager;

  // State
  private initialized = false;
  private running = false;
  private lastState: AttentionState = 'uncertain';
  private lastStateTimestamp = 0;

  // Event listeners
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  constructor(config?: AttentionConfig) {
    this.config = resolveConfig(config);

    // Initialize all internal components
    this.cameraManager = new CameraManager(this.config);
    this.faceDetector = new FaceDetector(this.config);
    this.headPoseEstimator = new HeadPoseEstimator(this.config);
    this.gazeEstimator = new GazeEstimator(this.config);
    this.eyeStateEstimator = new EyeStateEstimator(this.config);
    this.temporalAnalyzer = new TemporalAnalyzer(this.config);
    this.calibrationManager = new CalibrationManager();

    const classifier = new RuleBasedClassifier(this.config);
    this.attentionAnalyzer = new AttentionAnalyzer(this.config, classifier);

    this.pipeline = new ProcessingPipeline(
      this.config,
      this.faceDetector,
      this.headPoseEstimator,
      this.gazeEstimator,
      this.eyeStateEstimator,
      this.temporalAnalyzer,
      this.attentionAnalyzer,
    );

    // Wire up pipeline callbacks
    this.pipeline.onResult = (result) => this.handleResult(result);
    this.pipeline.onError = (error) => this.handleError(error);

    // Wire up camera disconnect
    this.cameraManager.onDisconnect = () => {
      this.emitError({
        code: 'CAMERA_DISCONNECTED',
        message: 'Camera was disconnected',
        recoverable: false,
      });
      this.stop();
    };
  }

  /**
   * Initialize the monitor (load models, prepare resources).
   * Must be called before start().
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.faceDetector.init();
      this.initialized = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emitError({
        code: 'MODEL_LOAD_FAILED',
        message: `Failed to load face detection model: ${err.message}`,
        recoverable: false,
        originalError: err,
      });
      throw err;
    }
  }

  /**
   * Start monitoring. Opens the camera and begins processing.
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('AttentionMonitor: Must call init() before start()');
    }
    if (this.running) return;

    try {
      const videoElement = await this.cameraManager.start();
      this.running = true;
      this.lastState = 'uncertain';
      this.lastStateTimestamp = performance.now();
      this.pipeline.start(videoElement);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.handleCameraError(err);
      throw err;
    }
  }

  /**
   * Stop monitoring. Stops processing but keeps resources loaded.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.pipeline.stop();
    this.cameraManager.stop();
  }

  /**
   * Completely destroy the monitor and release all resources.
   * After calling this, the monitor cannot be restarted.
   */
  destroy(): void {
    this.stop();
    this.faceDetector.destroy();
    this.cameraManager.destroy();
    this.pipeline.reset();
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Attach an external video element instead of using the internal camera.
   * The external video must already have a stream attached.
   */
  attachVideoElement(video: HTMLVideoElement): void {
    this.cameraManager.attachVideoElement(video);
  }

  /**
   * Start calibration. Returns instructions for the first step.
   * Feed gaze samples by continuing to process frames during calibration.
   */
  async calibrate(): Promise<void> {
    if (!this.config.calibrationEnabled) {
      throw new Error('AttentionMonitor: Calibration is disabled in config');
    }
    if (!this.running) {
      throw new Error('AttentionMonitor: Must be running to calibrate');
    }

    return new Promise<void>((resolve) => {
      this.calibrationManager.onProgress = (step, progress, instruction) => {
        this.emit('calibration', { step, progress, instruction });

        if (step === 'complete') {
          // Apply calibration data to gaze estimator
          this.gazeEstimator.applyCalibration(this.calibrationManager.getCalibrationData());
          this.calibrationManager.onProgress = null;
          resolve();
        }
      };

      this.calibrationManager.startCalibration();
    });
  }

  /**
   * Check if the monitor is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if the monitor is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current resolved configuration.
   */
  getConfig(): Readonly<ResolvedAttentionConfig> {
    return this.config;
  }

  /**
   * Get calibration data (for saving/restoring).
   */
  getCalibrationData() {
    return this.calibrationManager.getCalibrationData();
  }

  /**
   * Load previously saved calibration data.
   */
  loadCalibration(data: Parameters<CalibrationManager['loadCalibration']>[0]): void {
    this.calibrationManager.loadCalibration(data);
    this.gazeEstimator.applyCalibration(data);
  }

  /**
   * List available camera devices.
   */
  static async listCameras(): Promise<MediaDeviceInfo[]> {
    return CameraManager.listDevices();
  }

  // --- Event API ---

  /**
   * Subscribe to an event.
   */
  on<K extends keyof AttentionEventMap>(
    event: K,
    callback: EventCallback<AttentionEventMap[K]>,
  ): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
    return this;
  }

  /**
   * Unsubscribe from an event.
   */
  off<K extends keyof AttentionEventMap>(
    event: K,
    callback: EventCallback<AttentionEventMap[K]>,
  ): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback<unknown>);
    }
    return this;
  }

  /**
   * Subscribe to an event once.
   */
  once<K extends keyof AttentionEventMap>(
    event: K,
    callback: EventCallback<AttentionEventMap[K]>,
  ): this {
    const wrapper = ((data: AttentionEventMap[K]) => {
      this.off(event, wrapper);
      callback(data);
    }) as EventCallback<AttentionEventMap[K]>;
    return this.on(event, wrapper);
  }

  // --- Private methods ---

  private emit<K extends keyof AttentionEventMap>(event: K, data: AttentionEventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          // Don't let listener errors crash the pipeline
          if (this.config.debug) {
            // eslint-disable-next-line no-console
            console.error(`[AttentionMonitor] Error in '${event}' listener:`, e);
          }
        }
      });
    }
  }

  private handleResult(result: AttentionResult): void {
    // Feed to calibration if in progress
    if (this.calibrationManager.isInProgress() && result.gaze) {
      const stepComplete = this.calibrationManager.addSample({
        horizontalRatioLeft: 0,
        horizontalRatioRight: 0,
        verticalRatioLeft: 0,
        verticalRatioRight: 0,
        horizontalRatio: (result.gaze.horizontal / 2) + 0.5, // Convert back from [-1,1] to [0,1]
        verticalRatio: (result.gaze.vertical / 2) + 0.5,
        confidence: result.gaze.confidence / 100,
      });
      if (stepComplete) {
        this.calibrationManager.nextStep();
      }
    }

    // Emit update
    this.emit('update', result);

    // Check for state change
    if (result.state !== this.lastState) {
      const now = performance.now();
      const previousDuration = now - this.lastStateTimestamp;

      const stateChangeEvent: StateChangeEvent = {
        previous: this.lastState,
        current: result.state,
        result,
        previousStateDurationMs: previousDuration,
      };

      this.emit('stateChange', stateChangeEvent);

      // Emit specific state events
      if (result.state === 'focused') {
        this.emit('focused', result);
      } else if (result.state === 'absent') {
        this.emit('absent', result);
      } else if (
        result.state === 'looking_away' ||
        result.state === 'looking_left' ||
        result.state === 'looking_right' ||
        result.state === 'looking_up' ||
        result.state === 'looking_down' ||
        result.state === 'eyes_closed'
      ) {
        this.emit('distracted', result);
      }

      this.lastState = result.state;
      this.lastStateTimestamp = now;
    }

    // Check for warnings
    if (result.debug && result.debug.facesDetected > 1) {
      this.emitWarning({
        code: 'MULTIPLE_FACES',
        message: `${result.debug.facesDetected} faces detected, tracking primary face`,
      });
    }

    if (result.debug && result.debug.fps > 0 && result.debug.fps < 10) {
      this.emitWarning({
        code: 'LOW_FPS',
        message: `Processing FPS is low: ${result.debug.fps}`,
      });
    }
  }

  private handleError(error: Error): void {
    this.emitError({
      code: 'PROCESSING_ERROR',
      message: error.message,
      recoverable: true,
      originalError: error,
    });
  }

  private handleCameraError(error: Error): void {
    let code: AttentionError['code'] = 'UNKNOWN';
    const msg = error.message.toLowerCase();

    if (msg.includes('permission') || msg.includes('notallowed')) {
      code = 'CAMERA_PERMISSION_DENIED';
    } else if (msg.includes('not found') || msg.includes('notfound')) {
      code = 'CAMERA_NOT_FOUND';
    } else if (msg.includes('in use') || msg.includes('notreadable')) {
      code = 'CAMERA_IN_USE';
    }

    this.emitError({
      code,
      message: error.message,
      recoverable: false,
      originalError: error,
    });
  }

  private emitError(error: AttentionError): void {
    this.emit('error', error);
  }

  private emitWarning(warning: AttentionWarning): void {
    this.emit('warning', warning);
  }
}
