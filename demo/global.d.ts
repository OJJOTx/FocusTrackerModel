export type OctopusEdge = 'top' | 'right' | 'bottom' | 'left';

export interface FocusOverlayState {
  state:
    | 'focused'
    | 'looking_away'
    | 'looking_left'
    | 'looking_right'
    | 'looking_up'
    | 'looking_down'
    | 'eyes_closed'
    | 'absent'
    | 'uncertain';
  attentionScore: number;
  facePresent: boolean;
  lookingAwayMs: number;
  absentMs: number;
  eyesClosedMs: number;
}

declare global {
  interface Window {
    focusOverlay: {
      publishState(payload: FocusOverlayState): void;
      beginDrag(screenX: number, screenY: number): void;
      drag(screenX: number, screenY: number): void;
      endDrag(): void;
      onState(callback: (payload: FocusOverlayState) => void): () => void;
      onEdge(callback: (edge: OctopusEdge) => void): () => void;
    };
  }
}

export {};
