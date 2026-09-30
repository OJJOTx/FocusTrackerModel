import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';

type OctopusEdge = 'top' | 'right' | 'bottom' | 'left';

interface DragState {
  pointerOffsetX: number;
  pointerOffsetY: number;
}

const OCTOPUS_WIDTH = 150;
const OCTOPUS_HEIGHT = 120;

let mainWindow: BrowserWindow | null = null;
let octopusWindow: BrowserWindow | null = null;
let currentEdge: OctopusEdge = 'top';
let dragState: DragState | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../../demo/index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
    octopusWindow?.close();
  });
}

function createOctopusWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  octopusWindow = new BrowserWindow({
    width: OCTOPUS_WIDTH,
    height: OCTOPUS_HEIGHT,
    x: Math.round(workArea.x + (workArea.width - OCTOPUS_WIDTH) / 2),
    y: workArea.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  octopusWindow.setAlwaysOnTop(true, 'floating');
  octopusWindow.loadFile(path.join(__dirname, '../../demo/octopus-overlay.html'));

  octopusWindow.webContents.on('did-finish-load', () => {
    octopusWindow?.webContents.send('focus-overlay:edge', currentEdge);
  });

  octopusWindow.on('closed', () => {
    octopusWindow = null;
  });
}

function updateOctopusDrag(screenX: number, screenY: number): void {
  if (!octopusWindow || !dragState) return;

  const desiredX = screenX - dragState.pointerOffsetX;
  const desiredY = screenY - dragState.pointerOffsetY;
  const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
  const workArea = display.workArea;

  const distances: Record<OctopusEdge, number> = {
    top: Math.abs(desiredY - workArea.y),
    bottom: Math.abs(desiredY + OCTOPUS_HEIGHT - (workArea.y + workArea.height)),
    left: Math.abs(desiredX - workArea.x),
    right: Math.abs(desiredX + OCTOPUS_WIDTH - (workArea.x + workArea.width)),
  };

  const edge = (Object.entries(distances) as [OctopusEdge, number][])
    .sort((a, b) => a[1] - b[1])[0][0];

  let x = desiredX;
  let y = desiredY;

  if (edge === 'top' || edge === 'bottom') {
    x = clamp(
      desiredX,
      workArea.x,
      workArea.x + workArea.width - OCTOPUS_WIDTH,
    );
    y =
      edge === 'top'
        ? workArea.y
        : workArea.y + workArea.height - OCTOPUS_HEIGHT;
  } else {
    x =
      edge === 'left'
        ? workArea.x
        : workArea.x + workArea.width - OCTOPUS_WIDTH;
    y = clamp(
      desiredY,
      workArea.y,
      workArea.y + workArea.height - OCTOPUS_HEIGHT,
    );
  }

  octopusWindow.setPosition(Math.round(x), Math.round(y), false);

  if (edge !== currentEdge) {
    currentEdge = edge;
    octopusWindow.webContents.send('focus-overlay:edge', currentEdge);
  }
}

ipcMain.on('focus-overlay:publish', (event, payload) => {
  if (!mainWindow || event.sender.id !== mainWindow.webContents.id) return;
  octopusWindow?.webContents.send('focus-overlay:state', payload);
});

ipcMain.on('focus-overlay:drag-start', (event, point: { x: number; y: number }) => {
  if (!octopusWindow || event.sender.id !== octopusWindow.webContents.id) return;

  const bounds = octopusWindow.getBounds();
  dragState = {
    pointerOffsetX: point.x - bounds.x,
    pointerOffsetY: point.y - bounds.y,
  };
});

ipcMain.on('focus-overlay:drag', (event, point: { x: number; y: number }) => {
  if (!octopusWindow || event.sender.id !== octopusWindow.webContents.id) return;
  updateOctopusDrag(point.x, point.y);
});

ipcMain.on('focus-overlay:drag-end', (event) => {
  if (!octopusWindow || event.sender.id !== octopusWindow.webContents.id) return;
  dragState = null;
});

app.whenReady().then(() => {
  createMainWindow();
  createOctopusWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createOctopusWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
