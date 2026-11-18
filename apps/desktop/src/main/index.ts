import { app, BrowserWindow, ipcMain, shell, powerMonitor, Tray, dialog } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import child_process from 'node:child_process';
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

  function getHumanDeviceName(): string {
    try {
      const user = os.userInfo().username;
      if (user && user.toLowerCase() !== 'user' && user.toLowerCase() !== 'administrator') {
        const capitalized = user.charAt(0).toUpperCase() + user.slice(1);
        return `${capitalized}'s Laptop`;
      }
    } catch {}
    const hostname = os.hostname();
    return hostname.replace(/[-_]/g, ' ');
  }

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

  ipcMain.on('system:getDeviceName', (event: any) => {
    event.returnValue = getHumanDeviceName();
  });

  ipcMain.handle('app:setProgress', (_event: any, progress: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 0 to 1 sets progress; -1 clears taskbar progress bar
      mainWindow.setProgressBar(progress >= 0 && progress <= 1 ? progress : -1);
    }
  });

  let preselectedSavePath: string | null = null;

  ipcMain.on('system:getDefaultSaveDir', (event: any) => {
    const defaultDownloads = path.join(os.homedir(), 'Downloads', 'Orbit');
    if (!fs.existsSync(defaultDownloads)) {
      fs.mkdirSync(defaultDownloads, { recursive: true });
    }
    event.returnValue = defaultDownloads;
  });

  ipcMain.handle('transfer:setPreselectedSavePath', (_event: any, savePath: string | null) => {
    preselectedSavePath = savePath;
    return true;
  });

  ipcMain.handle('dialog:chooseSavePath', async (_event: any, defaultFilename: string) => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const defaultDownloads = path.join(os.homedir(), 'Downloads', 'Orbit');
    if (!fs.existsSync(defaultDownloads)) {
      fs.mkdirSync(defaultDownloads, { recursive: true });
    }
    const defaultFilePath = path.join(defaultDownloads, defaultFilename || 'download');

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Choose Save Location',
      defaultPath: defaultFilePath,
      properties: ['showOverwriteConfirmation'],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    preselectedSavePath = result.filePath;
    return result.filePath;
  });

  ipcMain.handle('shell:openDownloads', async () => {
    const downloadsPath = path.join(os.homedir(), 'Downloads', 'Orbit');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    await shell.openPath(downloadsPath);
  });

  // 3. Create Main Browser Window (Expansive Desktop Aspect Ratio)
  mainWindow = new BrowserWindow({
    width: 860,
    height: 620,
    minWidth: 600,
    minHeight: 520,
    title: 'Orbit',
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
    const defaultDownloads = path.join(os.homedir(), 'Downloads', 'Orbit');
    if (!fs.existsSync(defaultDownloads)) {
      fs.mkdirSync(defaultDownloads, { recursive: true });
    }
    const defaultFilePath = path.join(defaultDownloads, item.getFilename());

    let saveFilePath: string | null = null;

    if (preselectedSavePath === 'DEFAULT_DOWNLOADS') {
      // User explicitly picked default Downloads folder
      saveFilePath = defaultFilePath;
      preselectedSavePath = null;
    } else if (preselectedSavePath) {
      // User pre-selected custom location in UI
      saveFilePath = preselectedSavePath;
      preselectedSavePath = null;
    } else {
      // Prompt user with native OS Save Dialog if not preselected
      const chosenPath = dialog.showSaveDialogSync(mainWindow!, {
        title: 'Save Received File',
        defaultPath: defaultFilePath,
        properties: ['showOverwriteConfirmation'],
      });

      if (!chosenPath) {
        item.cancel();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download:failed', {
            filename: item.getFilename(),
            state: 'cancelled',
          });
        }
        return;
      }
      saveFilePath = chosenPath;
    }

    const targetExtractDir = path.dirname(saveFilePath);
    item.setSavePath(saveFilePath);

    let lastBytes = 0;
    let lastTime = Date.now();
    let currentSpeed = 0;

    item.on('updated', (_event: any, state: string) => {
      if (state === 'progressing') {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        const now = Date.now();
        const elapsedSec = (now - lastTime) / 1000;
        if (elapsedSec >= 0.4) {
          currentSpeed = (received - lastBytes) / elapsedSec;
          lastBytes = received;
          lastTime = now;
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          if (total > 0) {
            mainWindow.setProgressBar(received / total);
          }
          mainWindow.webContents.send('download:progress', {
            filename: item.getFilename(),
            bytesTransferred: received,
            fileSize: total,
            percentage: total > 0 ? (received / total) * 100 : 0,
            currentSpeed,
          });
        }
      }
    });

    item.once('done', (_event: any, state: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
      if (state === 'completed') {
        const filename = item.getFilename();
        console.log(`Download completed and saved to: ${saveFilePath}`);

        // Auto-unpack TAR folder bundles directly into the chosen folder on disk
        if (filename.endsWith('.tar')) {
          try {
            child_process.execFile('tar', ['-xf', saveFilePath, '-C', targetExtractDir], (err) => {
              if (!err) {
                console.log(`Auto-unpacked ${filename} directly into ${targetExtractDir}`);
              }
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download:completed', {
                  filename,
                  savePath: saveFilePath,
                  unpacked: !err,
                });
              }
            });
            return;
          } catch (e) {
            console.warn('Tar auto-unpack error:', e);
          }
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download:completed', {
            filename,
            savePath: saveFilePath,
          });
        }
      } else {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download:failed', {
            filename: item.getFilename(),
            state,
          });
        }
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
