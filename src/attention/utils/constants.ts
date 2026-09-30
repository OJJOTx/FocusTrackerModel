/**
 * MediaPipe 478 face landmarks - key indices
 */
export const FACE_LANDMARKS = {
  // Nose
  noseTip: 1,
  noseBottom: 2,
  
  // Chin
  chin: 152,
  
  // Left eye (from user's perspective = right side of image)
  leftEyeInnerCorner: 133,
  leftEyeOuterCorner: 33,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  leftEyeUpperOuter: 158,
  leftEyeLowerOuter: 153,
  
  // Right eye
  rightEyeInnerCorner: 362,
  rightEyeOuterCorner: 263,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  rightEyeUpperOuter: 385,
  rightEyeLowerOuter: 380,
  
  // Left iris (landmarks 468-472)
  leftIrisCenter: 468,
  leftIris: [468, 469, 470, 471, 472],
  
  // Right iris (landmarks 473-477)
  rightIrisCenter: 473,
  rightIris: [473, 474, 475, 476, 477],
  
  // Mouth corners
  leftMouthCorner: 61,
  rightMouthCorner: 291,
  
  // Forehead / top of face
  forehead: 10,

  // For head pose PnP (6 key points)
  pnpPoints: {
    noseTip: 1,
    chin: 152,
    leftEyeOuterCorner: 33,
    rightEyeOuterCorner: 263,
    leftMouthCorner: 61,
    rightMouthCorner: 291,
  },
};

/**
 * EAR landmarks - 6 points per eye for Eye Aspect Ratio
 */
export const EAR_LANDMARKS = {
  // Left eye: p1=outer, p2=upper-outer, p3=upper-inner, p4=inner, p5=lower-inner, p6=lower-outer
  left: [33, 160, 158, 133, 153, 144],
  // Right eye
  right: [263, 387, 385, 362, 380, 373],
};

/**
 * 3D model points for head pose estimation (generic face model)
 * These are approximate 3D coordinates of the 6 PnP landmarks
 * in a canonical face model coordinate system (in mm-like units).
 */
export const FACE_3D_MODEL: { x: number; y: number; z: number }[] = [
  { x: 0.0, y: 0.0, z: 0.0 },       // Nose tip
  { x: 0.0, y: -330.0, z: -65.0 },   // Chin
  { x: -225.0, y: 170.0, z: -135.0 }, // Left eye outer corner
  { x: 225.0, y: 170.0, z: -135.0 },  // Right eye outer corner
  { x: -150.0, y: -150.0, z: -125.0 },// Left mouth corner
  { x: 150.0, y: -150.0, z: -125.0 }, // Right mouth corner
];
