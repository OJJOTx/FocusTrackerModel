/**
 * Demo Renderer
 *
 * Demonstrates the Visual Attention Monitoring Engine in an Electron window.
 * Shows real-time camera preview with attention state, score, and debug overlays.
 */

import { AttentionMonitor } from '../src/attention/index';
import type { AttentionResult } from '../src/attention/index';

// DOM Elements
const video = document.getElementById('webcam') as HTMLVideoElement;
const canvas = document.getElementById('overlay') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
const calibrateBtn = document.getElementById('calibrateBtn') as HTMLButtonElement;
const debugToggleBtn = document.getElementById('debugToggleBtn') as HTMLButtonElement;

const currentStateEl = document.getElementById('currentState') as HTMLElement;
const scoreBar = document.getElementById('scoreBar') as HTMLElement;
const scoreText = document.getElementById('scoreText') as HTMLElement;
const gazeDirEl = document.getElementById('gazeDir') as HTMLElement;
const headPoseEl = document.getElementById('headPose') as HTMLElement;
const eyeStateEl = document.getElementById('eyeState') as HTMLElement;

const focusedTimeEl = document.getElementById('focusedTime') as HTMLElement;
const lookingAwayTimeEl = document.getElementById('lookingAwayTime') as HTMLElement;
const absentTimeEl = document.getElementById('absentTime') as HTMLElement;

// State
let monitor: AttentionMonitor | null = null;
let debugMode = true;
let isRunning = false;
let animFrameId = 0;
let latestResult: AttentionResult | null = null;

// --- State display helpers ---

const STATE_COLORS: Record<string, string> = {
  focused: '#4caf50',
  looking_away: '#ff9800',
  looking_left: '#ff9800',
  looking_right: '#ff9800',
  looking_up: '#ff9800',
  looking_down: '#ff9800',
  eyes_closed: '#9c27b0',
  absent: '#f44336',
  uncertain: '#607d8b',
};

function updateStateDisplay(state: string) {
  currentStateEl.innerText = state.toUpperCase().replace('_', ' ');
  currentStateEl.style.color = STATE_COLORS[state] || '#607d8b';
}

function updateScoreBar(score: number) {
  const pct = Math.round(score);
  scoreBar.style.width = `${pct}%`;
  scoreText.innerText = `${pct}%`;

  if (pct > 70) {
    scoreBar.style.backgroundColor = '#4caf50';
  } else if (pct > 40) {
    scoreBar.style.backgroundColor = '#ff9800';
  } else {
    scoreBar.style.backgroundColor = '#f44336';
  }
}

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

// --- Debug overlay ---

function drawDebugOverlay() {
  if (!isRunning) return;

  // Match canvas to video size
  if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (debugMode && latestResult && latestResult.debug) {
    const w = canvas.width;
    const h = canvas.height;
    const debug = latestResult.debug;

    // Draw debug text panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, 10, 220, 120);
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${debug.fps}`, 20, 30);
    ctx.fillText(`Latency: ${debug.processingLatencyMs}ms`, 20, 46);
    ctx.fillText(`Raw Score: ${debug.rawScore}`, 20, 62);
    ctx.fillText(`Smoothed: ${debug.smoothedScore}`, 20, 78);
    ctx.fillText(`Faces: ${debug.facesDetected}`, 20, 94);
    ctx.fillText(`EAR L:${debug.leftEAR.toFixed(3)} R:${debug.rightEAR.toFixed(3)}`, 20, 110);
    ctx.fillText(`Iris H:${debug.rawIrisHorizontalLeft.toFixed(3)}`, 20, 126);

    // Draw head pose direction arrow at center
    if (latestResult.headPose) {
      const { yaw, pitch } = latestResult.headPose;
      const cx = w / 2;
      const cy = h / 2;
      const len = 80;

      const radYaw = (yaw * Math.PI) / 180;
      const radPitch = (pitch * Math.PI) / 180;

      const endX = cx + Math.sin(radYaw) * len;
      const endY = cy + Math.sin(radPitch) * len;

      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrow head
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(endX, endY, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  animFrameId = requestAnimationFrame(drawDebugOverlay);
}

// --- Main init ---

async function init() {
  try {
    currentStateEl.innerText = 'INITIALIZING...';

    monitor = new AttentionMonitor({
      debug: true,
      processingFps: 20,
      outputIntervalMs: 200,
    });

    await monitor.init();

    // Subscribe to events
    monitor.on('update', (result: AttentionResult) => {
      latestResult = result;

      updateStateDisplay(result.state);
      updateScoreBar(result.attentionScore);
      gazeDirEl.innerText = result.gaze.direction.toUpperCase();
      headPoseEl.innerText = `Y: ${result.headPose.yaw}°  P: ${result.headPose.pitch}°  R: ${result.headPose.roll}°`;
      eyeStateEl.innerText = result.eyes.leftOpen && result.eyes.rightOpen
        ? 'OPEN'
        : !result.eyes.leftOpen && !result.eyes.rightOpen
          ? 'CLOSED'
          : 'PARTIAL';
      focusedTimeEl.innerText = formatDuration(result.timing.focusedMs);
      lookingAwayTimeEl.innerText = formatDuration(result.timing.lookingAwayMs);
      absentTimeEl.innerText = formatDuration(result.timing.absentMs);
    });

    monitor.on('stateChange', (event) => {
      // eslint-disable-next-line no-console
      console.log(`State: ${event.previous} → ${event.current} (${event.previousStateDurationMs}ms)`);
    });

    monitor.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Attention error:', err.code, err.message);
      currentStateEl.innerText = 'ERROR: ' + err.code;
      currentStateEl.style.color = '#f44336';
    });

    monitor.on('warning', (warn) => {
      // eslint-disable-next-line no-console
      console.warn('Attention warning:', warn.code, warn.message);
    });

    currentStateEl.innerText = 'READY';
    currentStateEl.style.color = '#607d8b';
    startBtn.disabled = false;

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Init failed:', error);
    currentStateEl.innerText = 'INIT FAILED';
    currentStateEl.style.color = '#f44336';
  }
}

// --- Button handlers ---

startBtn.addEventListener('click', async () => {
  if (!monitor) return;

  try {
    await monitor.start();
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    calibrateBtn.disabled = false;

    // Start debug overlay loop
    drawDebugOverlay();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Start failed:', err);
  }
});

stopBtn.addEventListener('click', () => {
  if (!monitor) return;
  monitor.stop();
  isRunning = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  calibrateBtn.disabled = true;
  cancelAnimationFrame(animFrameId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  currentStateEl.innerText = 'STOPPED';
  currentStateEl.style.color = '#607d8b';
});

calibrateBtn.addEventListener('click', async () => {
  if (!monitor || !isRunning) return;
  try {
    currentStateEl.innerText = 'CALIBRATING...';
    await monitor.calibrate();
    // eslint-disable-next-line no-console
    console.log('Calibration complete');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Calibration failed:', err);
  }
});

debugToggleBtn.addEventListener('click', () => {
  debugMode = !debugMode;
  debugToggleBtn.innerText = debugMode ? 'Debug: ON' : 'Debug: OFF';
  if (!debugMode) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
});

// Initialize on load
init();
