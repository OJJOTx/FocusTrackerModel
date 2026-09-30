import type { FocusOverlayState, OctopusEdge } from './global';

const shell = document.getElementById('octopusShell') as HTMLDivElement;
const stateLabel = document.getElementById('stateLabel') as HTMLSpanElement;
const scoreLabel = document.getElementById('scoreLabel') as HTMLSpanElement;

let dragging = false;
let activePointerId: number | null = null;

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

function applyState(payload: FocusOverlayState): void {
  document.body.dataset.state = payload.state;
  stateLabel.innerText = friendlyState(payload.state);
  scoreLabel.innerText = `${Math.round(payload.attentionScore)}%`;

  const severity =
    payload.state === 'absent'
      ? 'angry'
      : payload.state === 'eyes_closed'
        ? 'sleepy'
        : payload.state === 'focused'
          ? 'happy'
          : payload.state === 'uncertain'
            ? 'neutral'
            : 'concerned';

  document.body.dataset.mood = severity;
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
