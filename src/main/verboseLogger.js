import { jsonStore } from '../store/jsonStore.js';

let win = null;

function setWindow(browserWindow) {
  win = browserWindow;
}

async function verboseLog(source, ...args) {
  try {
    const settings = await jsonStore.settingsDb.read();
    if (!settings.isVerbose) return;
  } catch {
    return;
  }

  const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(`[${source}]`, message);

  try {
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('verbose-log', { source, message, timestamp: Date.now() });
    }
  } catch {
    // window unavailable
  }
}

export { setWindow, verboseLog };
