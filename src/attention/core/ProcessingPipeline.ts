/**
 * Processing Pipeline
 *
 * Orchestrates the frame processing pipeline:
 * camera frame → face detection → feature extraction → temporal analysis → attention result
 *
 * Handles frame rate throttling and coordinates all vision estimators.
 */

import { AttentionFeatures } from '../types/AttentionFeatures';
import { AttentionResult } from '../types/AttentionResult';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { FaceDetector } from '../vision/FaceDetector';
import { HeadPoseEstimator } from '../vision/HeadPoseEstimator';
import { GazeEstimator } from '../vision/GazeEstimator';
import { EyeStateEstimator } from '../vision/EyeStateEstimator';
import { TemporalAnalyzer } from './TemporalAnalyzer';
import { AttentionAnalyzer } from './AttentionAnalyzer';
import { AttentionState } from '../types/AttentionResult';

export class ProcessingPipeline {
  private readonly config: ResolvedAttentionConfig;
  private readonly faceDetector: FaceDetector;
  private readonly headPoseEstimator: HeadPoseEstimator;
  private readonly gazeEstimator: GazeEstimator;
  private readonly eyeStateEstimator: EyeStateEstimator;
  private readonly temporalAnalyzer: TemporalAnalyzer;
  private readonly attentionAnalyzer: AttentionAnalyzer;

  private animationFrameId: number | null = null;
  private backgroundTimerId: number | null = null;
  private lastProcessingTimestamp = 0;
  private lastOutputTimestamp = 0;
  private isRunning = false;

  /** Callback for when a new result is ready */
  onResult: ((result: AttentionResult) => void) | null = null;

  /** Callback for errors during processing */
  onError: ((error: Error) => void) | null = null;

  constructor(
    config: ResolvedAttentionConfig,
    faceDetector: FaceDetector,
    headPoseEstimator: HeadPoseEstimator,
    gazeEstimator: GazeEstimator,
    eyeStateEstimator: EyeStateEstimator,
    temporalAnalyzer: TemporalAnalyzer,
    attentionAnalyzer: AttentionAnalyzer,
  ) {
    this.config = config;
    this.faceDetector = faceDetector;
    this.headPoseEstimator = headPoseEstimator;
    this.gazeEstimator = gazeEstimator;
    this.eyeStateEstimator = eyeStateEstimator;
    this.temporalAnalyzer = temporalAnalyzer;
    this.attentionAnalyzer = attentionAnalyzer;
  }

  /**
   * Start the processing loop.
   *
   * @param videoElement - The video element to process frames from
   */
  start(videoElement: HTMLVideoElement): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastProcessingTimestamp = 0;
    this.lastOutputTimestamp = 0;
    if (this.backgroundTimerId !== null) {
      window.clearTimeout(this.backgroundTimerId);
      this.backgroundTimerId = null;
    }

    const scheduleNext = (): void => {
      if (!this.isRunning) return;

      // requestAnimationFrame can stop entirely when an Electron window is
      // minimized. Fall back to a timer while hidden so webcam analysis keeps
      // feeding the always-on-top companion window.
      if (typeof document !== 'undefined' && document.hidden) {
        this.backgroundTimerId = window.setTimeout(
          processFrame,
          Math.max(16, 1000 / this.config.processingFps),
        );
      } else {
        this.animationFrameId = requestAnimationFrame(processFrame);
      }
    };

    const processFrame = () => {
      if (!this.isRunning) return;

      try {
        const now = performance.now();
        const processingInterval = 1000 / this.config.processingFps;

        // Throttle processing to target FPS
        if (now - this.lastProcessingTimestamp >= processingInterval) {
          this.lastProcessingTimestamp = now;

          // Only process if video is ready
          if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const startTime = performance.now();
            const result = this.processFrame(videoElement, now);
            const latency = performance.now() - startTime;

            // Throttle output to configured interval
            if (result && now - this.lastOutputTimestamp >= this.config.outputIntervalMs) {
              this.lastOutputTimestamp = now;
              this.onResult?.(result);
            }

            // Store latency for debug (it's already computed in the result)
            void latency;
          }
        }
      } catch (error) {
        this.onError?.(error instanceof Error ? error : new Error(String(error)));
      }

      // Continue loop using the foreground/background appropriate scheduler.
      scheduleNext();
    };

    scheduleNext();
  }

  /**
   * Stop the processing loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.backgroundTimerId !== null) {
      window.clearTimeout(this.backgroundTimerId);
      this.backgroundTimerId = null;
    }
  }

  /**
   * Reset all internal state.
   */
  reset(): void {
    this.headPoseEstimator.reset();
    this.gazeEstimator.reset();
    this.eyeStateEstimator.reset();
    this.temporalAnalyzer.reset();
    this.attentionAnalyzer.reset();
    this.lastProcessingTimestamp = 0;
    this.lastOutputTimestamp = 0;
  }

  /**
   * Process a single video frame through the full pipeline.
   */
  private processFrame(
    videoElement: HTMLVideoElement,
    timestamp: number,
  ): AttentionResult | null {
    const startTime = performance.now();

    // Step 1: Face detection
    const faceResult = this.faceDetector.detect(videoElement);

    // Step 2: Feature extraction (only if face detected)
    let features: AttentionFeatures;

    if (faceResult.detected && faceResult.landmarks) {
      const landmarks = faceResult.landmarks;
      const fw = faceResult.frameWidth;
      const fh = faceResult.frameHeight;

      const headPose = this.headPoseEstimator.estimate(landmarks, fw, fh);
      const eyeState = this.eyeStateEstimator.estimate(landmarks);
      const rawGaze = this.gazeEstimator.estimate(landmarks);

      // Do not trust binocular iris direction when exactly one eye is closed
      // or either eye geometry is low-quality. This prevents a wink/occlusion
      // from turning into false LOOKING_UP / LOOKING_AWAY events.
      const gazeUnreliable =
        eyeState.leftOpen !== eyeState.rightOpen ||
        eyeState.leftConfidence < 0.35 ||
        eyeState.rightConfidence < 0.35;

      const gaze = gazeUnreliable
        ? { ...rawGaze, confidence: 0 }
        : rawGaze;

      features = {
        timestamp,
        face: faceResult,
        gaze,
        headPose,
        eyeState,
      };
    } else {
      features = {
        timestamp,
        face: faceResult,
        gaze: null,
        headPose: null,
        eyeState: null,
      };
    }

    // Step 3: Temporal analysis
    const temporal = this.temporalAnalyzer.update(features);

    // Step 4: Attention analysis
    const processingLatency = performance.now() - startTime;
    const result = this.attentionAnalyzer.analyze(features, temporal, processingLatency);

    // Update temporal state with the classified state
    this.temporalAnalyzer.updateState(result.state as AttentionState, timestamp);

    return result;
  }
}
