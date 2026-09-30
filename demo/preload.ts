import { contextBridge, ipcRenderer } from 'electron';
import type {
  FocusOverlayState,
  OctopusEdge,
} from './global';

contextBridge.exposeInMainWorld('focusOverlay', {
  publishState: (payload: FocusOverlayState): void => {
    ipcRenderer.send('focus-overlay:publish', payload);
  },

  beginDrag: (screenX: number, screenY: number): void => {
    ipcRenderer.send('focus-overlay:drag-start', { x: screenX, y: screenY });
  },

  drag: (screenX: number, screenY: number): void => {
    ipcRenderer.send('focus-overlay:drag', { x: screenX, y: screenY });
  },

  endDrag: (): void => {
    ipcRenderer.send('focus-overlay:drag-end');
  },

  onState: (callback: (payload: FocusOverlayState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: FocusOverlayState) => {
      callback(payload);
    };
    ipcRenderer.on('focus-overlay:state', listener);
    return () => ipcRenderer.removeListener('focus-overlay:state', listener);
  },

  onEdge: (callback: (edge: OctopusEdge) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, edge: OctopusEdge) => {
      callback(edge);
    };
    ipcRenderer.on('focus-overlay:edge', listener);
    return () => ipcRenderer.removeListener('focus-overlay:edge', listener);
  },
});
