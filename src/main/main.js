import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './backend/server.js';
import { setWindow } from './verboseLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let serverInfo = null;

async function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../devops.ico');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    maximizable: true,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  setWindow(mainWindow);

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools with F12 or Ctrl+Shift+I instead of auto-opening
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function initialize() {
  try {
    serverInfo = await startServer(0);
    console.log(`Backend server running on port ${serverInfo.port}`);

    ipcMain.handle('get-api-port', () => serverInfo.port);
    ipcMain.handle('reload', () => mainWindow?.webContents.reload());
    ipcMain.handle('force-reload', () => mainWindow?.webContents.reloadIgnoringCache());
    ipcMain.handle('toggle-dev-tools', () => mainWindow?.webContents.toggleDevTools());

    await createWindow();
  } catch (error) {
    console.error('Failed to start backend server:', error);
    app.quit();
  }
}

app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverInfo?.server) {
      serverInfo.server.close();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverInfo?.server) {
    serverInfo.server.close();
  }
});
