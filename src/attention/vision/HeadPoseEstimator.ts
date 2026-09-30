/**
 * Head Pose Estimator
 *
 * Estimates head yaw, pitch, and roll from face landmarks using
 * a geometric approach based on relative landmark positions.
 *
 * Uses 6 canonical face landmarks:
 * - Nose tip (1)
 * - Chin (152)
 * - Left eye outer corner (33)
 * - Right eye outer corner (263)
 * - Left mouth corner (61)
 * - Right mouth corner (291)
 */

import { HeadPoseFeatures, FaceLandmark } from '../types/AttentionFeatures';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';
import { FACE_LANDMARKS, FACE_3D_MODEL } from '../utils/constants';
import { solvePnP } from '../utils/pnp';
import { ExponentialMovingAverage } from '../utils/smoothing';
import { Point2D } from '../utils/math';

/** Indices of the 6 PnP landmarks in order matching FACE_3D_MODEL */
const PNP_LANDMARK_INDICES = [
  FACE_LANDMARKS.pnpPoints.noseTip,
  FACE_LANDMARKS.pnpPoints.chin,
  FACE_LANDMARKS.pnpPoints.leftEyeOuterCorner,
  FACE_LANDMARKS.pnpPoints.rightEyeOuterCorner,
  FACE_LANDMARKS.pnpPoints.leftMouthCorner,
  FACE_LANDMARKS.pnpPoints.rightMouthCorner,
];

export class HeadPoseEstimator {
  private readonly yawEMA: ExponentialMovingAverage;
  private readonly pitchEMA: ExponentialMovingAverage;
  private readonly rollEMA: ExponentialMovingAverage;

  constructor(_config: ResolvedAttentionConfig) {
    // Moderate smoothing for head pose
    this.yawEMA = new ExponentialMovingAverage(0.4);
    this.pitchEMA = new ExponentialMovingAverage(0.4);
    this.rollEMA = new ExponentialMovingAverage(0.4);
  }

  /**
   * Estimate head pose from face landmarks.
   *
   * @param landmarks - 478 MediaPipe face landmarks (normalized 0-1)
   * @param frameWidth - Video frame width in pixels
   * @param frameHeight - Video frame height in pixels
   * @returns Head pose features with yaw, pitch, roll, and confidence
   */
  estimate(
    landmarks: FaceLandmark[],
    frameWidth: number,
    frameHeight: number,
  ): HeadPoseFeatures {
    if (!landmarks || landmarks.length < 292) {
      return { yaw: 0, pitch: 0, roll: 0, confidence: 0 };
    }

    // Extract the 6 2D points, converting from normalized to pixel coordinates
    const imagePoints: Point2D[] = PNP_LANDMARK_INDICES.map((index) => {
      const lm = landmarks[index];
      return {
        x: lm.x * frameWidth,
        y: lm.y * frameHeight,
      };
    });

    // Approximate focal length (common assumption for webcams)
    const focalLength = frameWidth;
    const center: Point2D = { x: frameWidth / 2, y: frameHeight / 2 };

    // Solve for pose
    const pose = solvePnP(imagePoints, FACE_3D_MODEL, focalLength, center);

    // Apply EMA smoothing to reduce jitter
    const smoothedYaw = this.yawEMA.update(pose.yaw);
    const smoothedPitch = this.pitchEMA.update(pose.pitch);
    const smoothedRoll = this.rollEMA.update(pose.roll);

    // Confidence: higher when face is more frontal (less extreme angles)
    const maxAngle = Math.max(Math.abs(smoothedYaw), Math.abs(smoothedPitch));
    const confidence = Math.max(0.2, 1.0 - maxAngle / 90);

    return {
      yaw: smoothedYaw,
      pitch: smoothedPitch,
      roll: smoothedRoll,
      confidence,
    };
  }

  /**
   * Reset smoothing state.
   */
  reset(): void {
    this.yawEMA.reset();
    this.pitchEMA.reset();
    this.rollEMA.reset();
  }
}
