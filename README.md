# Visual Attention Monitoring Engine

A reusable, modular, **local** real-time library for monitoring observable visual attention signals from a webcam feed. Designed for integration into Electron desktop applications.

> **Important**: This system monitors **observable visual attention indicators** only. It does **not** detect mental focus, understanding, thoughts, or cognitive engagement. Webcam-based gaze estimation cannot prove what a person is actually thinking or paying attention to.

## What It Does

- Detects whether a user is **present** or **absent** from the camera
- Estimates **gaze direction** (center, left, right, up, down)
- Estimates **head pose** (yaw, pitch, roll)
- Detects whether **eyes are open or closed**
- Tracks **prolonged eye closure**
- Measures **how long** the user has been looking away, absent, or focused
- Computes an explainable **attention score** (0-100)
- Classifies a high-level **state**: focused, looking_away, looking_left, looking_right, looking_up, looking_down, eyes_closed, absent, uncertain

## What It Does NOT Do

- ❌ Read minds or detect cognitive focus
- ❌ Determine if someone understands content
- ❌ Measure engagement or interest
- ❌ Provide precise screen-coordinate eye tracking
- ❌ Upload any data to remote servers
- ❌ Record video or save frames
- ❌ Use cloud AI APIs

## Installation

```bash
npm install
npm run download-models
```

The model download fetches the MediaPipe Face Landmarker model (~5MB) which is required for face detection and landmark extraction.

## Quick Start

```typescript
import { AttentionMonitor } from './src/attention';

const monitor = new AttentionMonitor({
  processingFps: 20,
  outputIntervalMs: 200,
  debug: false,
});

await monitor.init();

monitor.on('update', (result) => {
  console.log(`State: ${result.state}, Score: ${result.attentionScore}`);
});

monitor.on('stateChange', ({ previous, current }) => {
  console.log(`${previous} → ${current}`);
});

await monitor.start();

// Later:
monitor.stop();
monitor.destroy();
```

## Running the Demo

```bash
npm run download-models
npm run build
npm run demo
```

The demo opens an Electron window showing real-time camera preview with attention state, score, gaze direction, head pose, eye state, and timing information. Toggle the debug overlay to see internal processing data.

## Architecture

```
Webcam (getUserMedia)
  ↓
CameraManager
  ↓
FaceDetector (MediaPipe Face Landmarker)
  ↓
Feature Extraction
  ├── HeadPoseEstimator (geometric PnP)
  ├── GazeEstimator (iris geometry)
  ├── EyeStateEstimator (Eye Aspect Ratio)
  └── Face Presence
  ↓
TemporalAnalyzer (rolling windows, duration tracking)
  ↓
AttentionAnalyzer + RuleBasedClassifier
  ↓
AttentionResult → EventEmitter → Your App
```

### Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Face Detection + Landmarks | MediaPipe Face Landmarker | 478 landmarks incl. iris, single-pass, Apache 2.0, ~5MB |
| Gaze Estimation | Iris geometry (no extra model) | Simple, fast, reliable for direction classification |
| Head Pose | Pure TypeScript PnP solver | No OpenCV dependency |
| Eye State | Eye Aspect Ratio (EAR) | Standard, well-documented formula |
| Runtime | Electron renderer process | MediaPipe requires WebGL context |

## API Reference

### `AttentionMonitor`

The main public class. All other modules are internal.

#### Constructor

```typescript
new AttentionMonitor(config?: AttentionConfig)
```

#### Methods

| Method | Description |
|---|---|
| `init(): Promise<void>` | Load models and prepare resources. Must call before `start()`. |
| `start(): Promise<void>` | Start monitoring. Opens camera and begins processing. |
| `stop(): void` | Stop processing. Keeps resources loaded for restart. |
| `destroy(): void` | Release all resources. Cannot restart after this. |
| `calibrate(): Promise<void>` | Run 5-point calibration (center, left, right, up, down). |
| `attachVideoElement(video)` | Use an external video element instead of internal camera. |
| `isRunning(): boolean` | Check if currently monitoring. |
| `isInitialized(): boolean` | Check if models are loaded. |
| `getConfig()` | Get the resolved configuration. |
| `getCalibrationData()` | Get current calibration data (for persistence). |
| `loadCalibration(data)` | Load previously saved calibration data. |
| `AttentionMonitor.listCameras()` | Static: list available camera devices. |

#### Events

```typescript
monitor.on('update', (result: AttentionResult) => {});
monitor.on('stateChange', (event: StateChangeEvent) => {});
monitor.on('focused', (result: AttentionResult) => {});
monitor.on('distracted', (result: AttentionResult) => {});
monitor.on('absent', (result: AttentionResult) => {});
monitor.on('error', (error: AttentionError) => {});
monitor.on('warning', (warning: AttentionWarning) => {});
monitor.on('calibration', (event: CalibrationEvent) => {});
```

- `update` — fires on every output cycle with the full result
- `stateChange` — fires only when the state genuinely changes
- `focused` / `distracted` / `absent` — convenience events for specific states
- `error` — camera errors, model load failures, processing errors
- `warning` — non-critical issues (multiple faces, low FPS)

### `AttentionResult`

```typescript
interface AttentionResult {
  timestamp: number;
  facePresent: boolean;
  state: AttentionState;        // "focused" | "looking_away" | ... | "uncertain"
  attentionScore: number;       // 0-100
  confidence: number;           // 0-100

  gaze: {
    direction: GazeDirection;   // "center" | "left" | "right" | "up" | "down" | "unknown"
    horizontal: number;         // -1 to 1
    vertical: number;           // -1 to 1
    confidence: number;         // 0-100
  };

  headPose: {
    yaw: number;                // degrees
    pitch: number;              // degrees
    roll: number;               // degrees
    facingScreen: boolean;
  };

  eyes: {
    leftOpen: boolean;
    rightOpen: boolean;
    openness: number;           // 0-1
    closedDurationMs: number;
  };

  timing: {
    lookingAwayMs: number;
    absentMs: number;
    focusedMs: number;
  };

  debug?: DebugInfo;            // Only when debug: true
}
```

## Configuration

```typescript
const monitor = new AttentionMonitor({
  // Processing
  processingFps: 20,              // Vision processing target FPS
  outputIntervalMs: 200,          // Min interval between update events

  // Temporal thresholds
  lookingAwayThresholdMs: 1500,   // Duration before "looking_away" state
  absentThresholdMs: 2500,        // Duration before "absent" state
  prolongedEyeClosureMs: 1200,    // Duration before "eyes_closed" state
  lookingAwayGraceMs: 500,        // Brief glances ignored
  absentGraceMs: 1000,            // Brief detection failures ignored
  faceReacquisitionMs: 700,        // Stable face time before leaving absent
  lookingAwayEnterRatio: 0.65,     // Rolling-window hysteresis enter threshold
  lookingAwayExitRatio: 0.35,      // Rolling-window hysteresis exit threshold

  // Head pose thresholds (degrees)
  headYawThreshold: 20,           // Yaw beyond this = looking left/right
  headPitchThreshold: 15,         // Pitch beyond this = looking up/down
  facingScreenThreshold: 25,      // Max angle for "facing screen"

  // Eye thresholds
  eyeClosedThreshold: 0.20,       // EAR below this = eye closed
  eyeOpenThreshold: 0.25,         // EAR above this = eye open (hysteresis)

  // Gaze thresholds (iris position ratios)
  gazeThresholds: {
    horizontalLeft: 0.60,
    horizontalRight: 0.40,
    verticalUp: 0.35,
    verticalDown: 0.65,
    centerDeadZone: 0.08,
  },

  // Scoring
  scoreWeights: { gaze: 0.35, head: 0.30, presence: 0.20, eyes: 0.15 },
  scoreSmoothingAlpha: 0.3,       // EMA smoothing (0-1, lower = smoother)

  // Camera
  cameraDeviceId: null,           // null = use first available
  cameraWidth: 640,
  cameraHeight: 480,

  // MediaPipe
  modelPath: 'models/face_landmarker.task',
  maxFaces: 1,

  // Features
  calibrationEnabled: true,
  debug: false,
});
```

All fields are optional. Sensible defaults are provided.

## Attention Score Formula

The attention score (0-100) is computed from four weighted components:

```
score = 0.35 × gazeScore + 0.30 × headScore + 0.20 × presenceScore + 0.15 × eyeScore
```

| Component | How It's Computed |
|---|---|
| **gazeScore** | How centered the iris is within the eye. 100 = center, drops off toward edges. |
| **headScore** | How much the head faces the screen. 100 = directly facing, based on yaw/pitch. |
| **presenceScore** | Face detection confidence. 100 = face clearly visible. |
| **eyeScore** | Eye openness (EAR normalized). 100 = fully open. |

The raw score is smoothed with an Exponential Moving Average (configurable alpha) to prevent rapid fluctuations.

Weights are configurable via `scoreWeights` and must sum to 1.0.

## Calibration

Optional 5-point calibration improves gaze accuracy for individual users. The center step also captures a neutral head-pose baseline so normal laptop/camera angle is treated as screen-facing:

```typescript
// Programmatic calibration
await monitor.calibrate();

// The library emits calibration events you can use to guide the UI:
monitor.on('calibration', (event) => {
  // event.step: 'center' | 'left' | 'right' | 'up' | 'down' | 'complete'
  // event.instruction: "Look at the center of the screen"
  // event.progress: 0-1
  showCalibrationUI(event);
});

// Save/restore calibration
const data = monitor.getCalibrationData();
localStorage.setItem('calibration', JSON.stringify(data));

// Later:
monitor.loadCalibration(JSON.parse(localStorage.getItem('calibration')));
```

The system works without calibration using sensible defaults.

## Electron Integration

### Renderer Process Usage (Recommended)

The library runs entirely in the Electron renderer process using Web APIs:

```typescript
// renderer.ts (loaded via <script> or bundled)
import { AttentionMonitor } from 'focus-tracker';

const monitor = new AttentionMonitor({ debug: false });
await monitor.init();
await monitor.start();

monitor.on('update', (result) => {
  // Update your UI
});
```

### Security

The library respects Electron security best practices:
- ✅ Works with `contextIsolation: true`
- ✅ Works with `nodeIntegration: false`
- ✅ No Node.js APIs required in the renderer
- ✅ Uses only standard Web APIs (getUserMedia, Canvas, WebGL)

### IPC Communication

If your main process needs attention data, handle IPC in your app code:

```typescript
// renderer.ts
monitor.on('update', (result) => {
  window.electronAPI.sendAttention(result);
});

// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  sendAttention: (data) => ipcRenderer.send('attention-update', data),
});

// main.ts
ipcMain.on('attention-update', (event, result) => {
  // Use result in main process
});
```

## Performance

- **Target**: 15-30 FPS vision processing on typical laptop hardware
- **Output**: Configurable interval (default 5 updates/sec)
- **Model**: ~5MB MediaPipe Face Landmarker (float16)
- **GPU**: Uses WebGL acceleration when available, falls back to CPU

### Optimization Tips

- Reduce `processingFps` to lower CPU usage
- Increase `outputIntervalMs` to reduce event frequency
- Use `640x480` camera resolution (higher isn't needed for face landmarks)
- Set `debug: false` in production

## Privacy

**Privacy by design:**

- 🔒 All processing runs locally on the user's device
- 🔒 No video frames are recorded, saved, or transmitted
- 🔒 No biometric data is sent anywhere
- 🔒 No network requests after initial model download
- 🔒 Raw frames are discarded immediately after processing
- 🔒 Camera resources are properly released when stopped

## Edge Cases

| Scenario | Behavior |
|---|---|
| No camera permission | Emits `error` event with code `CAMERA_PERMISSION_DENIED` |
| Camera disconnected | Detects via track `ended` event, emits error, stops gracefully |
| Glasses | Works (MediaPipe handles well); iris accuracy may decrease slightly |
| Bad lighting | Lower detection confidence → `state: "uncertain"` |
| Multiple faces | Tracks largest/primary face, emits `MULTIPLE_FACES` warning |
| Fast head movements | Temporal smoothing prevents state flickering |
| Partial face | Lower confidence → may report `"uncertain"` |
| No face for < 1s | Treated as temporary detection failure (grace period) |
| No face for > 2.5s | Classified as `"absent"` |

## Testing

```bash
npm test              # Run all 72 tests
npm run test:watch    # Watch mode
```

Tests cover:
- Math utilities (distance, angles, vectors)
- Signal smoothing (EMA, moving average, One Euro filter)
- Eye state estimation (EAR, hysteresis)
- Gaze estimation (iris ratios, smoothing)
- Temporal analysis (duration tracking, state transitions)
- Attention scoring (component scores, smoothing)
- Integration (20-second simulated timeline with state verification)

## Known Limitations

1. **Gaze accuracy**: Iris-based gaze estimation provides directional classification (left/right/up/down/center), not precise screen coordinates
2. **Glasses**: Reflections on lenses can reduce iris landmark accuracy
3. **Extreme angles**: Head pose estimation degrades beyond ~60° yaw
4. **Single user**: Designed for one person in front of the camera
5. **Lighting**: Very dark or backlit environments reduce detection reliability
6. **No ML classifier yet**: V1 uses rule-based classification (architecture supports future ML)

## Future Improvements (V2+)

- [ ] ML-based attention classifier (replace rule-based)
- [ ] Session analytics and attention timeline
- [ ] Distraction event logging
- [ ] Charts and historical summaries
- [ ] Screen-region gaze estimation
- [ ] Multi-monitor support
- [ ] User-specific learned baselines
- [ ] Custom calibration profiles
- [ ] WebGPU acceleration
- [ ] Model quantization for smaller package

## Project Structure

```
FocusTracker/
├── src/attention/
│   ├── index.ts                    # Public API exports
│   ├── core/
│   │   ├── AttentionMonitor.ts     # Main public class
│   │   ├── AttentionAnalyzer.ts    # Score + result builder
│   │   ├── TemporalAnalyzer.ts     # Duration tracking
│   │   └── ProcessingPipeline.ts   # Frame processing loop
│   ├── vision/
│   │   ├── FaceDetector.ts         # MediaPipe wrapper
│   │   ├── HeadPoseEstimator.ts    # Geometric PnP
│   │   ├── GazeEstimator.ts        # Iris geometry
│   │   └── EyeStateEstimator.ts    # EAR-based
│   ├── camera/
│   │   └── CameraManager.ts       # Webcam management
│   ├── classifiers/
│   │   ├── AttentionClassifier.ts  # Interface
│   │   └── RuleBasedClassifier.ts  # V1 implementation
│   ├── calibration/
│   │   └── CalibrationManager.ts   # 5-point calibration
│   ├── types/
│   │   ├── AttentionResult.ts      # Output types
│   │   ├── AttentionConfig.ts      # Config + defaults
│   │   ├── AttentionFeatures.ts    # Internal feature types
│   │   └── AttentionEvents.ts      # Event types
│   └── utils/
│       ├── math.ts                 # Vector/angle utilities
│       ├── smoothing.ts            # EMA, MovingAverage, OneEuroFilter
│       ├── constants.ts            # Landmark indices, 3D model
│       └── pnp.ts                  # Head pose solver
├── demo/                           # Electron demo app
├── tests/                          # 72 unit + integration tests
├── models/                         # MediaPipe model files
└── scripts/                        # Model download script
```

## License

MIT
