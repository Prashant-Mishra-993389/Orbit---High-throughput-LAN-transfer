import { app, BrowserWindow, ipcMain, shell, powerMonitor, Tray } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startServer, RunningServer } from '@sharelan/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let runningServer: RunningServer | null = null;
let tray: Tray | null = null;
let isQuitting = false;

async function bootstrapApp() {
  // Prevent multiple instances
  const singleInstanceLock = app.requestSingleInstanceLock();
  if (!singleInstanceLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 1. Start embedded ShareLAN Fastify server
  // In packaged Electron: extraResources land at process.resourcesPath/web/out
  // In development (npm run dev from apps/desktop): walk up to apps/web/out
  const webDistPath = app.isPackaged
    ? path.join(process.resourcesPath, 'web', 'out')
    : path.resolve(__dirname, '../../../web/out');
  try {
    runningServer = await startServer({
      port: 37821,
      host: '0.0.0.0',
      autoTunnel: false, // Production uses Direct LAN and Production Relay
      webDistPath,
    });
    console.log(`Embedded ShareLAN server running on port ${runningServer.port}`);
  } catch (firstErr) {
    // Port 37821 already in use (e.g. dev server still running). Fall back to OS-assigned port.
    console.warn('Port 37821 in use, falling back to dynamic port:', firstErr);
    try {
      runningServer = await startServer({
        port: 0,
        host: '0.0.0.0',
        autoTunnel: false,
        webDistPath,
      });
      console.log(`Embedded ShareLAN server running on dynamic port ${runningServer.port}`);
    } catch (err) {
      console.error('Failed to start embedded server:', err);
    }
  }

  const serverPort = runningServer ? runningServer.port : 37821;

  // 2. Setup IPC bridges
  ipcMain.on('server:getUrl', (event: any) => {
    event.returnValue = `http://localhost:${serverPort}`;
  });

  ipcMain.on('server:getWsUrl', (event: any) => {
    event.returnValue = `ws://localhost:${serverPort}/ws`;
  });

  ipcMain.on('app:getVersion', (event: any) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.handle('app:setProgress', (_event: any, progress: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 0 to 1 sets progress; -1 clears taskbar progress bar
      mainWindow.setProgressBar(progress >= 0 && progress <= 1 ? progress : -1);
    }
  });

  ipcMain.handle('shell:openDownloads', async () => {
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'ShareLAN');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    await shell.openPath(downloadsPath);
  });

  // 3. Create Main Browser Window
  mainWindow = new BrowserWindow({
    width: 540,
    height: 780,
    minWidth: 440,
    minHeight: 620,
    title: 'ShareLAN',
    backgroundColor: '#030712',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Register native download handler for streaming downloads in Electron
  mainWindow.webContents.session.on('will-download', (_event: any, item: any) => {
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'ShareLAN');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    const saveFilePath = path.join(downloadsPath, item.getFilename());
    item.setSavePath(saveFilePath);

    item.on('updated', (_event: any, state: string) => {
      if (state === 'progressing') {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const received = item.getReceivedBytes();
          const total = item.getTotalBytes();
          if (total > 0) {
            mainWindow.setProgressBar(received / total);
          }
        }
      }
    });

    item.once('done', (_event: any, state: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
      if (state === 'completed') {
        console.log(`Download completed and saved to: ${saveFilePath}`);
      }
    });
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Load the web app from the embedded server
  await mainWindow.loadURL(`http://localhost:${serverPort}`);

  // Handle close to minimize to tray or clean quit
  mainWindow.on('close', (_event: any) => {
    if (!isQuitting) {
      // Allow window close to terminate app directly on Windows
    }
  });

  // 4. PowerMonitor: Sleep & Wake Lifecycle
  powerMonitor.on('resume', () => {
    console.log('System resumed from sleep: refreshing ShareLAN network listeners');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('network:system_resume');
    }
  });

  // 5. Clean Application Exit
  app.on('before-quit', async () => {
    isQuitting = true;
    if (runningServer) {
      console.log('Closing ShareLAN embedded server on application exit...');
      await runningServer.stop();
      runningServer = null;
    }
  });
}

app.whenReady().then(bootstrapApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
