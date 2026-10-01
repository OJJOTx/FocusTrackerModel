import { Point2D, Point3D, radiansToDegrees } from './math';

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * A simplified geometric Perspective-n-Point solver for head pose estimation.
 * Uses geometric heuristics rather than full iterative optimization.
 * 
 * @param imagePoints 6 2D points from image [nose, chin, leftEye, rightEye, leftMouth, rightMouth]
 * @param modelPoints 6 3D points from canonical model (not heavily used in this pure geometric solver, but kept for signature)
 * @param focalLength Approximate camera focal length
 * @param center Image center point
 * @returns Head pose with yaw, pitch, and roll in degrees
 */
export function solvePnP(
  imagePoints: Point2D[],
  _modelPoints: Point3D[],
  _focalLength: number,
  _center: Point2D
): HeadPose {
  if (imagePoints.length < 6) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const [nose, chin, leftEye, rightEye] = imagePoints;

  // 1. Roll: Angle of the line connecting eyes
  const dyEyes = rightEye.y - leftEye.y;
  const dxEyes = rightEye.x - leftEye.x;
  // Positive roll usually means tilting head to the right shoulder
  const rollRad = Math.atan2(dyEyes, dxEyes);
  const roll = radiansToDegrees(rollRad);

  // 2. Yaw: Horizontal displacement of the nose relative to the center of the eyes
  // We can use the ratio of left-half to right-half face width.
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;

  // Vector from eye center to nose
  const noseDirX = nose.x - eyeCenterX;
  const noseDirY = nose.y - eyeCenterY;

  // Face width (distance between eyes is a good proxy)
  const faceWidth = Math.hypot(dxEyes, dyEyes);

  // We can estimate yaw by looking at horizontal displacement of nose compared to face width
  // Roughly, if nose is far right of eye center, head is turned right.
  // We project the nose vector onto the eye-line vector to get a yaw metric independent of roll
  const eyeDirX = dxEyes / faceWidth;
  const eyeDirY = dyEyes / faceWidth;
  
  // Projection of nose-eyeCenter vector onto eye direction
  const projX = noseDirX * eyeDirX + noseDirY * eyeDirY;
  
  // Normalize by a factor to get degrees (heuristically tuned)
  // Max yaw is roughly 90 degrees when nose covers the eye
  let yaw = (projX / faceWidth) * 150; 
  yaw = Math.max(-90, Math.min(90, yaw));

  // 3. Pitch: Vertical displacement of the nose relative to eyes and chin
  // Distance from eye center to nose vs nose to chin
  // We project these onto the perpendicular of the eye line
  const perpX = -eyeDirY;
  const perpY = eyeDirX;

  const eyeToNose = noseDirX * perpX + noseDirY * perpY;
  
  const chinDirX = chin.x - nose.x;
  const chinDirY = chin.y - nose.y;
  const noseToChin = chinDirX * perpX + chinDirY * perpY;

  // Ratio of upper face to lower face
  // In a neutral face, this ratio is roughly constant
  const pitchRatio = eyeToNose / (noseToChin || 1);
  
  // Heuristic conversion to degrees.
  // Keep the public convention consistent across the project:
  // negative pitch = looking up, positive pitch = looking down.
  // A user-specific calibration offset is applied later by HeadPoseEstimator.
  const neutralRatio = 0.7;
  let pitch = (neutralRatio - pitchRatio) * 100;
  pitch = Math.max(-90, Math.min(90, pitch));

  return { yaw, pitch, roll };
}
