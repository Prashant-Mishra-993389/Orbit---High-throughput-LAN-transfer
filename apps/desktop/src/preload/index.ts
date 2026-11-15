// Preload script must use CommonJS (no ESM import/export)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.sendSync('server:getUrl'),
  getWsUrl: () => ipcRenderer.sendSync('server:getWsUrl'),
  getAppVersion: () => ipcRenderer.sendSync('app:getVersion'),
  openDownloadsFolder: () => ipcRenderer.invoke('shell:openDownloads'),
  setTaskbarProgress: (progress: number) => ipcRenderer.invoke('app:setProgress', progress),
});
