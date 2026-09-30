/**
 * Calibration Manager
 *
 * Manages optional user calibration for gaze estimation.
 * Calibration improves accuracy by capturing individual baseline
 * iris positions at known gaze directions.
 *
 * 5-point calibration: center, left, right, up, down
 * Each step records iris ratios for ~2 seconds.
 */

import { CalibrationData, GazeFeatures, HeadPoseFeatures } from '../types/AttentionFeatures';

/** Calibration step name */
export type CalibrationStep = 'center' | 'left' | 'right' | 'up' | 'down';

/** Calibration step instructions */
const STEP_INSTRUCTIONS: Record<CalibrationStep, string> = {
  center: 'Look directly at the center of the screen',
  left: 'Look at the left edge of the screen',
  right: 'Look at the right edge of the screen',
  up: 'Look at the top edge of the screen',
  down: 'Look at the bottom edge of the screen',
};

/** All calibration steps in order */
const CALIBRATION_STEPS: CalibrationStep[] = ['center', 'left', 'right', 'up', 'down'];

/** How many samples to collect per step */
const SAMPLES_PER_STEP = 30;

export class CalibrationManager {
  private calibrationData: CalibrationData;
  private currentStepIndex = -1;
  private samples: { horizontal: number; vertical: number; headPose?: { yaw: number; pitch: number; roll: number } }[] = [];
  private isCalibrating = false;

  /** Callback for calibration progress */
  onProgress: ((step: CalibrationStep | 'complete', progress: number, instruction: string) => void) | null = null;

  constructor() {
    this.calibrationData = this.createEmptyCalibrationData();
  }

  /**
   * Get the current calibration data.
   */
  getCalibrationData(): CalibrationData {
    return { ...this.calibrationData };
  }

  /**
   * Check if calibration is in progress.
   */
  isInProgress(): boolean {
    return this.isCalibrating;
  }

  /**
   * Start a new calibration session.
   */
  startCalibration(): { step: CalibrationStep; instruction: string } {
    this.calibrationData = this.createEmptyCalibrationData();
    this.currentStepIndex = 0;
    this.samples = [];
    this.isCalibrating = true;

    const step = CALIBRATION_STEPS[0];
    return {
      step,
      instruction: STEP_INSTRUCTIONS[step],
    };
  }

  /**
   * Feed a gaze sample during calibration.
   * Returns true when the current step is complete.
   */
  addSample(gazeFeatures: GazeFeatures, headPose?: HeadPoseFeatures | null): boolean {
    if (!this.isCalibrating || this.currentStepIndex < 0) return false;

    // Only accept samples with reasonable confidence
    if (gazeFeatures.confidence < 0.3) return false;

    this.samples.push({
      horizontal: gazeFeatures.horizontalRatio,
      vertical: gazeFeatures.verticalRatio,
      headPose: headPose
        ? { yaw: headPose.yaw, pitch: headPose.pitch, roll: headPose.roll }
        : undefined,
    });

    // Report progress
    const currentStep = CALIBRATION_STEPS[this.currentStepIndex];
    const progress = this.samples.length / SAMPLES_PER_STEP;
    this.onProgress?.(currentStep, Math.min(1, progress), STEP_INSTRUCTIONS[currentStep]);

    // Check if we have enough samples for this step
    if (this.samples.length >= SAMPLES_PER_STEP) {
      this.completeCurrentStep();
      return true;
    }

    return false;
  }

  /**
   * Advance to the next calibration step.
   * Returns null if calibration is complete.
   */
  nextStep(): { step: CalibrationStep; instruction: string } | null {
    if (!this.isCalibrating) return null;

    this.currentStepIndex++;
    this.samples = [];

    if (this.currentStepIndex >= CALIBRATION_STEPS.length) {
      this.finishCalibration();
      return null;
    }

    const step = CALIBRATION_STEPS[this.currentStepIndex];
    return {
      step,
      instruction: STEP_INSTRUCTIONS[step],
    };
  }

  /**
   * Cancel an in-progress calibration.
   */
  cancelCalibration(): void {
    this.isCalibrating = false;
    this.currentStepIndex = -1;
    this.samples = [];
  }

  /**
   * Reset calibration data to defaults.
   */
  resetCalibration(): void {
    this.calibrationData = this.createEmptyCalibrationData();
    this.cancelCalibration();
  }

  /**
   * Load previously saved calibration data.
   */
  loadCalibration(data: CalibrationData): void {
    this.calibrationData = { ...data };
  }

  // --- Private methods ---

  private completeCurrentStep(): void {
    if (this.samples.length === 0) return;

    const step = CALIBRATION_STEPS[this.currentStepIndex];

    // Average the samples
    const avgHorizontal =
      this.samples.reduce((sum, s) => sum + s.horizontal, 0) / this.samples.length;
    const avgVertical =
      this.samples.reduce((sum, s) => sum + s.vertical, 0) / this.samples.length;

    this.calibrationData[step] = {
      horizontal: avgHorizontal,
      vertical: avgVertical,
    };

    if (step === 'center') {
      const poseSamples = this.samples.filter((s) => s.headPose);
      if (poseSamples.length > 0) {
        this.calibrationData.headPoseCenter = {
          yaw: poseSamples.reduce((sum, s) => sum + (s.headPose?.yaw ?? 0), 0) / poseSamples.length,
          pitch: poseSamples.reduce((sum, s) => sum + (s.headPose?.pitch ?? 0), 0) / poseSamples.length,
          roll: poseSamples.reduce((sum, s) => sum + (s.headPose?.roll ?? 0), 0) / poseSamples.length,
        };
      }
    }
  }

  private finishCalibration(): void {
    this.isCalibrating = false;
    this.calibrationData.isCalibrated = true;
    this.calibrationData.calibratedAt = Date.now();

    this.onProgress?.('complete', 1, 'Calibration complete!');
  }

  private createEmptyCalibrationData(): CalibrationData {
    return {
      center: null,
      left: null,
      right: null,
      up: null,
      down: null,
      headPoseCenter: null,
      isCalibrated: false,
      calibratedAt: null,
    };
  }
}
