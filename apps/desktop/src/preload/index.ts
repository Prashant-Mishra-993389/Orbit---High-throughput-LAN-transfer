// Preload script must use CommonJS (no ESM import/export)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getServerUrl: () => ipcRenderer.sendSync('server:getUrl'),
  getWsUrl: () => ipcRenderer.sendSync('server:getWsUrl'),
  getAppVersion: () => ipcRenderer.sendSync('app:getVersion'),
  getDeviceName: () => ipcRenderer.sendSync('system:getDeviceName'),
  openDownloadsFolder: () => ipcRenderer.invoke('shell:openDownloads'),
  setTaskbarProgress: (progress: number) => ipcRenderer.invoke('app:setProgress', progress),
  onDownloadProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, val: any) => callback(val);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onDownloadCompleted: (callback: (data: any) => void) => {
    const handler = (_event: any, val: any) => callback(val);
    ipcRenderer.on('download:completed', handler);
    return () => ipcRenderer.removeListener('download:completed', handler);
  },
  onDownloadFailed: (callback: (data: any) => void) => {
    const handler = (_event: any, val: any) => callback(val);
    ipcRenderer.on('download:failed', handler);
    return () => ipcRenderer.removeListener('download:failed', handler);
  },
});
