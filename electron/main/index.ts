import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import { initTray, updateTrayMenu } from './tray';
import { registerIpcHandlers } from './ipc';
import { getKeyList } from './keyManager';
import { initNotifier } from './notifier';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const useDevServer = process.env.USE_DEV_SERVER === 'true';

function getWebPath(): string {
  if (useDevServer) {
    return 'http://localhost:5173';
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web', 'index.html');
  }
  // Dev mode without dev server - load from ../web/dist
  return path.join(__dirname, '..', '..', '..', 'web', 'dist', 'index.html');
}

function getPreloadPath(): string {
  return path.join(__dirname, '..', 'preload', 'index.js');
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 800,
    minHeight: 500,
    show: false,
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#09090b' : '#ffffff',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const webPath = getWebPath();
  if (webPath.startsWith('http')) {
    mainWindow.loadURL(webPath);
  } else {
    mainWindow.loadFile(webPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('http:') || details.url.startsWith('https:')) {
      require('electron').shell.openExternal(details.url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

async function initApp() {
  console.log('[oroio] Starting app...');

  // Set dock icon on macOS (for dev mode)
  if (process.platform === 'darwin' && !app.isPackaged) {
    const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
    app.dock.setIcon(iconPath);
  }

  registerIpcHandlers();

  try {
    console.log('[oroio] Getting key list...');
    const keys = await getKeyList();
    console.log('[oroio] Keys loaded:', keys.length);

    console.log('[oroio] Initializing tray...');
    initTray(keys);
    console.log('[oroio] Tray initialized');

    initNotifier(keys);

    // Auto open main window on start
    createMainWindow();
    console.log('[oroio] App ready');
  } catch (err) {
    console.error('[oroio] Init error:', err);
  }
}

app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  // Keep app running in tray on macOS
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Refresh tray when keys change
ipcMain.on('keys-updated', async () => {
  const keys = await getKeyList();
  updateTrayMenu(keys);
});
