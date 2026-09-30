import { ResolvedAttentionConfig } from '../types/AttentionConfig';

/**
 * Manages webcam capture for the Visual Attention Monitoring Engine.
 * 
 * Supports two modes:
 * 1. Internal management: creates and manages its own video element
 * 2. External attachment: accepts an existing HTMLVideoElement
 * 
 * Privacy: Frames are only processed in real-time and never stored or transmitted.
 */
export class CameraManager {
  private config: ResolvedAttentionConfig;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isOwnedVideo: boolean = false;
  private isStarted: boolean = false;
  
  /**
   * Callback invoked when the camera disconnects or the track ends.
   */
  public onDisconnect: (() => void) | null = null;

  constructor(config: ResolvedAttentionConfig) {
    this.config = config;
  }

  /**
   * Start internal camera capture.
   * Creates a hidden video element and opens the webcam.
   * 
   * @returns A promise that resolves to the HTMLVideoElement when ready.
   */
  async start(): Promise<HTMLVideoElement> {
    if (this.isStarted && this.videoElement) {
      return this.videoElement;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: this.config.cameraWidth,
          height: this.config.cameraHeight,
          facingMode: 'user'
        }
      };

      if (this.config.cameraDeviceId && typeof constraints.video === 'object') {
        constraints.video.deviceId = { exact: this.config.cameraDeviceId };
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Handle disconnection detection
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.handleDisconnect();
        };
      }

      this.videoElement = document.createElement('video');
      this.videoElement.style.display = 'none';
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      
      this.isOwnedVideo = true;
      this.videoElement.srcObject = this.stream;

      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) return reject(new Error('Video element destroyed before load'));
        
        const onLoadedData = () => {
          resolve();
          cleanup();
        };
        
        const onError = (e: Event | string) => {
          reject(new Error(`Video playback failed: ${e}`));
          cleanup();
        };

        const cleanup = () => {
          if (this.videoElement) {
            this.videoElement.removeEventListener('loadeddata', onLoadedData);
            this.videoElement.removeEventListener('error', onError);
          }
        };

        this.videoElement.addEventListener('loadeddata', onLoadedData);
        this.videoElement.addEventListener('error', onError);
        
        this.videoElement.play().catch(onError);
      });

      this.isStarted = true;
      return this.videoElement;
    } catch (error: unknown) {
      this.stop(); // Cleanup any partial state
      const err = error instanceof Error ? error : new Error(String(error));
      let errorMessage = 'Failed to start camera: ' + err.message;
      if ('name' in err && err.name === 'NotAllowedError') {
        errorMessage = 'CAMERA_PERMISSION_DENIED: Permission to access the camera was denied.';
      } else if ('name' in err && err.name === 'NotFoundError') {
        errorMessage = 'CAMERA_NOT_FOUND: No camera device was found.';
      } else if ('name' in err && err.name === 'NotReadableError') {
        errorMessage = 'CAMERA_IN_USE: The camera is already in use by another application.';
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Attach an external video element that already has a stream.
   * The CameraManager will NOT manage the stream lifecycle.
   * 
   * @param video The existing HTMLVideoElement to use.
   */
  attachVideoElement(video: HTMLVideoElement): void {
    this.stop(); // Stop internal stream if it exists
    this.videoElement = video;
    this.isOwnedVideo = false;
    this.isStarted = true;
    
    // Attempt to hook onto track ended if possible
    if (video.srcObject instanceof MediaStream) {
      const videoTrack = video.srcObject.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', this.handleDisconnect);
      }
    }
  }

  /**
   * Get the current video element (internal or external).
   * 
   * @returns The HTMLVideoElement or null if not started/attached.
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  /**
   * Check if the video is ready for processing.
   * 
   * @returns True if the video has data ready to be processed.
   */
  isReady(): boolean {
    if (!this.videoElement || !this.isStarted) return false;
    return this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  /**
   * Stop the camera and release resources.
   */
  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        track.onended = null;
      });
      this.stream = null;
    }

    if (this.videoElement) {
      if (!this.isOwnedVideo && this.videoElement.srcObject instanceof MediaStream) {
        const videoTrack = this.videoElement.srcObject.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.removeEventListener('ended', this.handleDisconnect);
        }
      }
      
      if (this.isOwnedVideo) {
        this.videoElement.pause();
        this.videoElement.srcObject = null;
        this.videoElement.remove();
      }
      this.videoElement = null;
    }

    this.isStarted = false;
    this.isOwnedVideo = false;
  }

  /**
   * Completely destroy, releasing all references.
   */
  destroy(): void {
    this.stop();
    this.onDisconnect = null;
  }

  /**
   * List available camera devices.
   * 
   * @returns A promise resolving to an array of video input devices.
   */
  static async listDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error('Failed to enumerate devices: ' + err.message);
    }
  }

  /**
   * Internal handler for camera disconnection.
   */
  private handleDisconnect = (): void => {
    this.stop();
    if (this.onDisconnect) {
      this.onDisconnect();
    }
  };
}
