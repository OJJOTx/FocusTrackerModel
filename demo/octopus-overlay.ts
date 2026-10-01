import type { FocusOverlayState, OctopusEdge } from './global';

const shell = document.getElementById('octopusShell') as HTMLDivElement;
const stateLabel = document.getElementById('stateLabel') as HTMLSpanElement;
const scoreLabel = document.getElementById('scoreLabel') as HTMLSpanElement;

let dragging = false;
let activePointerId: number | null = null;

let currentVisualState: FocusOverlayState['state'] = 'uncertain';
let pendingState: FocusOverlayState['state'] | null = null;
let stateTimer: number | null = null;
let transitionTimer: number | null = null;

function friendlyState(state: FocusOverlayState['state']): string {
  switch (state) {
    case 'focused':
      return 'Focused';
    case 'looking_away':
      return 'Hmm...';
    case 'looking_left':
      return 'Look left';
    case 'looking_right':
      return 'Look right';
    case 'looking_up':
      return 'Look up';
    case 'looking_down':
      return 'Look down';
    case 'eyes_closed':
      return 'Sleepy';
    case 'absent':
      return 'Come back!';
    case 'uncertain':
    default:
      return 'Watching';
  }
}

function moodForState(
  state: FocusOverlayState['state'],
): 'happy' | 'concerned' | 'sleepy' | 'angry' | 'neutral' {
  if (state === 'absent') return 'angry';
  if (state === 'eyes_closed') return 'sleepy';
  if (state === 'focused') return 'happy';
  if (state === 'uncertain') return 'neutral';
  return 'concerned';
}

function commitVisualState(state: FocusOverlayState['state']): void {
  if (state === currentVisualState) return;

  document.body.dataset.transitioning = 'true';

  // Small squeeze/fade before morphing the expression. This makes color,
  // eyes, brows and mouth changes feel like one animation instead of a jump.
  window.setTimeout(() => {
    currentVisualState = state;
    document.body.dataset.state = state;
    document.body.dataset.mood = moodForState(state);
    stateLabel.innerText = friendlyState(state);

    if (transitionTimer !== null) {
      window.clearTimeout(transitionTimer);
    }

    transitionTimer = window.setTimeout(() => {
      document.body.dataset.transitioning = 'false';
      transitionTimer = null;
    }, 280);
  }, 90);
}

function scheduleVisualState(state: FocusOverlayState['state']): void {
  if (state === currentVisualState) {
    pendingState = null;
    if (stateTimer !== null) {
      window.clearTimeout(stateTimer);
      stateTimer = null;
    }
    return;
  }

  if (pendingState === state) return;

  pendingState = state;
  if (stateTimer !== null) {
    window.clearTimeout(stateTimer);
  }

  // Do not visually react to a single noisy update. Severe states still
  // react quickly while normal direction changes get a short stabilization.
  const delay =
    state === 'absent' ? 80 :
    state === 'eyes_closed' ? 120 :
    state === 'focused' ? 140 :
    180;

  stateTimer = window.setTimeout(() => {
    if (pendingState === state) {
      commitVisualState(state);
      pendingState = null;
    }
    stateTimer = null;
  }, delay);
}

function applyState(payload: FocusOverlayState): void {
  // Keep the live score responsive even while the face animation is smoothing.
  scoreLabel.innerText = `${Math.round(payload.attentionScore)}%`;
  scheduleVisualState(payload.state);
}

function applyEdge(edge: OctopusEdge): void {
  document.body.dataset.edge = edge;
}

shell.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;

  dragging = true;
  activePointerId = event.pointerId;
  shell.setPointerCapture(event.pointerId);
  window.focusOverlay.beginDrag(event.screenX, event.screenY);
  event.preventDefault();
});

shell.addEventListener('pointermove', (event) => {
  if (!dragging || event.pointerId !== activePointerId) return;
  window.focusOverlay.drag(event.screenX, event.screenY);
});

function finishDrag(event?: PointerEvent): void {
  if (!dragging) return;

  if (
    event &&
    activePointerId !== null &&
    shell.hasPointerCapture(activePointerId)
  ) {
    shell.releasePointerCapture(activePointerId);
  }

  dragging = false;
  activePointerId = null;
  window.focusOverlay.endDrag();
}

shell.addEventListener('pointerup', finishDrag);
shell.addEventListener('pointercancel', finishDrag);
window.addEventListener('blur', () => finishDrag());

window.focusOverlay.onState(applyState);
window.focusOverlay.onEdge(applyEdge);
