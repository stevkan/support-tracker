const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getApiPort: () => ipcRenderer.invoke('get-api-port'),
  
  getApiBaseUrl: async () => {
    const port = await ipcRenderer.invoke('get-api-port');
    return `http://127.0.0.1:${port}`;
  },

  reload: () => ipcRenderer.invoke('reload'),
  forceReload: () => ipcRenderer.invoke('force-reload'),
  toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
  openTestData: () => ipcRenderer.invoke('open-test-data'),

  onVerboseLog: (callback) => {
    ipcRenderer.on('verbose-log', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('verbose-log');
  },
});
