import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FaceDetectionResult } from '../types/AttentionFeatures';
import { ResolvedAttentionConfig } from '../types/AttentionConfig';

/**
 * Wraps @mediapipe/tasks-vision FaceLandmarker for real-time face detection.
 */
export class FaceDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private config: ResolvedAttentionConfig;

  /**
   * Creates a new FaceDetector instance.
   * @param config The resolved attention configuration.
   */
  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
  }

  /**
   * Initializes the underlying FaceLandmarker model.
   */
  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(this.config.wasmBasePath);
    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: this.config.modelPath,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: this.config.maxFaces,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: this.config.minFaceDetectionConfidence,
      minFacePresenceConfidence: this.config.minFaceTrackingConfidence,
      minTrackingConfidence: this.config.minLandmarkConfidence,
    });
  }

  /**
   * Detects faces in a given video frame.
   * @param videoElement The HTMLVideoElement containing the current frame.
   * @returns FaceDetectionResult containing landmarks and detection metadata.
   */
  detect(videoElement: HTMLVideoElement): FaceDetectionResult {
    if (!this.faceLandmarker) {
      throw new Error("FaceDetector: FaceLandmarker is not initialized.");
    }

    const timestamp = performance.now();
    const result = this.faceLandmarker.detectForVideo(videoElement, timestamp);
    
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      // Return the primary (first) face landmarks
      const primaryLandmarks = result.faceLandmarks[0];
      return {
        detected: true,
        faceCount: result.faceLandmarks.length,
        landmarks: primaryLandmarks,
        confidence: 1.0, // Defaulting to 1.0 as confidence per landmark isn't directly exposed here
        frameWidth: videoElement.videoWidth,
        frameHeight: videoElement.videoHeight
      };
    }

    return {
      detected: false,
      faceCount: 0,
      landmarks: null,
      confidence: 0,
      frameWidth: videoElement.videoWidth,
      frameHeight: videoElement.videoHeight
    };
  }

  /**
   * Closes the FaceLandmarker and frees resources.
   */
  destroy(): void {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
  }
}
